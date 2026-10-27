# ShopNova

## Run locally

Install the root, client, and server dependencies, then start both services:

```sh
npm install
npm --prefix client install
npm --prefix server install
npm run dev
```

The existing production frontend bundle is served at `http://127.0.0.1:5173`.
The API listens at `http://127.0.0.1:5000`; check `http://127.0.0.1:5000/api/health`
to verify it is running.

The API currently uses in-memory demo data. Accounts, carts, and orders are
cleared when the server restarts. This is a local demo setup, not a production
store or payment service.
