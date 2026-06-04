# Merchant portal example (Vite)

Minimal Vite + React Router app using `@uids-io/auth-react` with the **merchant** OAuth client.

## Prerequisites

1. Build the SDK from the repo root: `npm run build`
2. Auth server running (`@advcomm/uids-io-auth` example on port **3000**)
3. Optional: API server on port **4000** for the `/me` button

See the [main README](../../README.md#local-development) for full setup.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 — sign in redirects to the auth server login UI, then returns to `/auth/callback`.
