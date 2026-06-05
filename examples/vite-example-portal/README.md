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

Open http://localhost:5173.

## What this example demonstrates

| File | Pattern |
|------|---------|
| `src/main.tsx` | `<AuthProvider>` + React Strict Mode |
| `src/pages/HomePage.tsx` | `loadProviders()` + provider buttons (`signIn({ provider })`) |
| `src/pages/CallbackPage.tsx` | `useAuthCallback()` — no hand-rolled `useEffect` |
| `src/pages/DashboardPage.tsx` | `useRequireAuth()` + `createAuthFetch()` |

Set `VITE_AUTH_ISSUER` to your auth base URL (include `/auth` if mounted there).

## Local dev OAuth clients (auth repo seed)

Seeded by `examples/express-auth-server` in `@advcomm/uids-io-auth`:

| App | `client_id` | Dev URL | Default redirect URI |
|-----|-------------|---------|------------------------|
| Merchant | `merchant_portal_web` | http://localhost:5173 | http://localhost:5173/auth/callback |
| Agency | `agency_portal_web` | http://localhost:5174 | http://localhost:5174/auth/callback |
| Influencer | `influencer_portal_web` | http://localhost:5175 | http://localhost:5175/auth/callback |
| Admin | `admin_portal_web` | http://localhost:5176 | http://localhost:5176/auth/callback |

This example uses **`merchant_portal_web`** on port **5173** (see `.env.example`).

## Quick test flows

1. **Sign in with Google** → lands on `/dashboard` with one `POST /token` in Network tab
2. **GET /api/me** on dashboard → 200 with user payload
3. **F5 on dashboard** → still signed in (cookie refresh or body mode)
4. **Sign out** → `POST /logout` 200, then home shows sign-in buttons again

Full checklist: [main README — End-to-end test checklist](../../README.md#end-to-end-test-checklist).
