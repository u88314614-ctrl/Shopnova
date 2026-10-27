const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");

const app = express();
const port = Number(process.env.PORT) || 5000;
const products = [
  {
    id: "daily-runner",
    slug: "daily-runner",
    name: "Daily Runner Sneakers",
    category: "Footwear",
    price: 2499,
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    description: "Lightweight everyday sneakers with a cushioned sole.",
    stock: 24,
    featured: true,
  },
  {
    id: "classic-watch",
    slug: "classic-watch",
    name: "Classic Minimal Watch",
    category: "Accessories",
    price: 3299,
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    description: "A clean, versatile watch for work and weekends.",
    stock: 18,
    featured: true,
  },
  {
    id: "canvas-tote",
    slug: "canvas-tote",
    name: "Everyday Canvas Tote",
    category: "Bags",
    price: 899,
    image:
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80",
    description: "A roomy, durable tote for everyday essentials.",
    stock: 35,
    featured: true,
  },
  {
    id: "wireless-headphones",
    slug: "wireless-headphones",
    name: "Wireless Headphones",
    category: "Electronics",
    price: 4199,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    description: "Comfortable over-ear headphones for music on the go.",
    stock: 12,
    featured: true,
  },
];

const users = new Map();
const sessions = new Map();
const carts = new Map();
const orders = new Map();

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json({ limit: "32kb" }));

function getUser(req) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  const email = token && sessions.get(token);
  return email ? users.get(email) : undefined;
}

function requireUser(req, res, next) {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }
  req.user = user;
  next();
}

function getCart(userId) {
  return carts.get(userId) ?? new Map();
}

function cartDetails(userId) {
  const cart = getCart(userId);
  const items = [...cart.entries()]
    .map(([productId, quantity]) => {
      const product = products.find((item) => item.id === productId);
      return product ? { id: productId, product, quantity } : null;
    })
    .filter(Boolean);
  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );
  const shipping = subtotal === 0 || subtotal >= 999 ? 0 : 99;
  const tax = Math.round(subtotal * 0.05);
  return {
    items,
    summary: { subtotal, shipping, tax, total: subtotal + shipping + tax },
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/products", (req, res) => {
  const search = String(req.query.search ?? "").trim().toLowerCase();
  const category = String(req.query.category ?? "");
  const featured = req.query.featured === "true";
  let result = products.filter(
    (product) =>
      (!search ||
        `${product.name} ${product.category}`.toLowerCase().includes(search)) &&
      (!category || product.category === category) &&
      (!featured || product.featured),
  );
  if (req.query.sort === "price-low") {
    result = [...result].sort((a, b) => a.price - b.price);
  } else if (req.query.sort === "price-high") {
    result = [...result].sort((a, b) => b.price - a.price);
  }
  res.json({ products: result });
});

app.get("/api/products/:slug", (req, res) => {
  const product = products.find(
    (item) => item.slug === req.params.slug || item.id === req.params.slug,
  );
  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }
  res.json({ product });
});

app.post("/api/auth/register", (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return res.status(400).json({
      message: "Enter a name, valid email, and password with at least 8 characters.",
    });
  }
  if (users.has(email)) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const salt = crypto.randomBytes(16);
  const passwordHash = crypto.scryptSync(password, salt, 64);
  const user = { id: crypto.randomUUID(), name, email, salt, passwordHash };
  users.set(email, user);
  carts.set(user.id, new Map());
  orders.set(user.id, []);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, user.email);
  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
});

app.post("/api/auth/login", (req, res) => {
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = users.get(email);
  if (!user) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  const passwordHash = crypto.scryptSync(password, user.salt, 64);
  if (!crypto.timingSafeEqual(user.passwordHash, passwordHash)) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, user.email);
  res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
});

app.get("/api/cart", requireUser, (req, res) => {
  res.json(cartDetails(req.user.id));
});

app.post("/api/cart", requireUser, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = products.find((item) => item.id === productId);
  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return res.status(400).json({ message: "A valid product and quantity are required." });
  }
  const cart = getCart(req.user.id);
  const nextQuantity = (cart.get(productId) ?? 0) + quantity;
  if (nextQuantity > product.stock) {
    return res.status(400).json({ message: "Requested quantity is not in stock." });
  }
  cart.set(productId, nextQuantity);
  carts.set(req.user.id, cart);
  res.status(201).json({ cart: [...cart].map(([id, count]) => ({ productId: id, quantity: count })) });
});

app.put("/api/cart/:productId", requireUser, (req, res) => {
  const { quantity } = req.body;
  const product = products.find((item) => item.id === req.params.productId);
  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) {
    return res.status(400).json({ message: "A valid in-stock quantity is required." });
  }
  const cart = getCart(req.user.id);
  if (!cart.has(product.id)) {
    return res.status(404).json({ message: "Cart item not found." });
  }
  cart.set(product.id, quantity);
  res.json({ cart: [...cart].map(([id, count]) => ({ productId: id, quantity: count })) });
});

app.delete("/api/cart/:productId", requireUser, (req, res) => {
  const cart = getCart(req.user.id);
  cart.delete(req.params.productId);
  res.json({ cart: [...cart].map(([id, quantity]) => ({ productId: id, quantity })) });
});

app.post("/api/orders/checkout", requireUser, (req, res) => {
  const cart = cartDetails(req.user.id);
  if (!cart.items.length) {
    return res.status(400).json({ message: "Your cart is empty." });
  }
  const order = {
    id: crypto.randomUUID(),
    items: cart.items,
    summary: cart.summary,
    status: "confirmed",
    payment: "cod",
    createdAt: new Date().toISOString(),
  };
  orders.get(req.user.id).unshift(order);
  carts.set(req.user.id, new Map());
  res.status(201).json({ order });
});

app.get("/api/orders", requireUser, (req, res) => {
  res.json({ orders: orders.get(req.user.id) ?? [] });
});

app.get("/api/admin/overview", (_req, res) => {
  const allOrders = [...orders.values()].flat();
  res.json({
    stats: {
      revenue: allOrders.reduce((total, order) => total + order.summary.total, 0),
      orders: allOrders.length,
      customers: users.size,
      products: products.length,
    },
  });
});

app.get("/api/admin/products", (_req, res) => {
  res.json({ products });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "API endpoint not found." });
});

app.listen(port, "localhost", () => {
  console.log(`ShopNova API listening at http://127.0.0.1:${port}`);
});
