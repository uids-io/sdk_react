# @uids-io/auth-react

Browser/React OAuth client for [`@advcomm/uids-io-auth`](https://github.com/advcomm/uids-io-auth). Implements the [client SDK contract](../auth/docs/sdk-contract.md): PKCE, device binding, refresh rotation, and SPA logout.

**Minimum server version:** `@advcomm/uids-io-auth` `>=0.1.0`

**Example app:** [`examples/vite-example-portal`](./examples/vite-example-portal)

**Code documentation:**

- **[Token storage & multi-tab security](./docs/TOKEN_STORAGE.md)** — cookie vs body, rotation, critical behavior
- **[Login providers](./docs/LOGIN_PROVIDERS.md)** — Google / Microsoft / email discovery & `signIn({ provider })`
- **[OAuth redirect plan](./docs/OAUTH_REDIRECT_PLAN.md)** — callback transaction, `useAuthCallback`, Strict Mode fix (implementation reference)
- [Architecture & module map](./docs/ARCHITECTURE.md)
- **IDE hovers** — JSDoc on `AuthClient`, `AuthReactConfig`, etc. (after `npm run build`)

---

## What this package does

| Component | Role |
|-----------|------|
| **Auth server** (`issuer`) | Runs `@advcomm/uids-io-auth` — login UI, `/authorize`, `/token`, `/refresh`, `/logout`, devices |
| **This SDK** | Your React app — PKCE redirect, tokens, hooks, API `fetch` helper |
| **API server** (`apiAudience`) | Your backend — validates Bearer tokens via `requireAuth` |

```mermaid
flowchart LR
  App[React app] -->|PKCE OAuth| Auth[Auth server issuer]
  App -->|Bearer access_token| API[API server]
  Auth -->|JWT signed with issuer| API
```

Each app build has **one** `clientId` + **one** `redirectUri`. All apps share the same `issuer` (and usually the same `apiAudience`).

---

## Install

```bash
npm install @uids-io/auth-react
```

**Peer dependency:** React 18 or 19.

---

## Integration checklist

Use this when wiring a new React app:

1. **Register OAuth client** on the auth server (`OAuthClientService.upsertPublicClient`) with this app’s `redirect_uri` and allowed origin.
2. **Env vars** — `VITE_AUTH_ISSUER`, `VITE_AUTH_CLIENT_ID`, `VITE_AUTH_REDIRECT_URI` (names may differ for CRA/Next).
3. **Callback route** — e.g. `/auth/callback` uses `useAuthCallback()` (strips `?code`, exchanges once).
4. **Root** — wrap the app in `<AuthProvider config={...}>`.
5. **Login page** — call `loadProviders()` before rendering provider sign-in buttons.
6. **API client** — Bearer from `getAccessToken()`; on 401 refresh once, else `signIn()` (`createAuthFetch`).
7. **Logout** — `signOut()` with cookie or body refresh token.
8. **CORS** — auth server allows your app’s `Origin`; API server must allow the app origin in production (or use a BFF/proxy).


---

## Configuration

### Environment variables (Vite)

```bash
# Auth server base URL — include mount path if router is not at host root
# Examples: http://localhost:3000  or  http://localhost:3000/auth
VITE_AUTH_ISSUER=http://localhost:3000

# Unique per app (must match upsertPublicClient on the auth server)
VITE_AUTH_CLIENT_ID=my_app_web

# Must match an allowed redirect URI for that client
VITE_AUTH_REDIRECT_URI=http://localhost:5173/auth/callback

# Optional: your API base URL (app → API, not auth)
VITE_API_URL=https://api.example.com
```

### `AuthReactConfig`

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `issuer` | Yes | — | Auth server base URL (see below) |
| `clientId` | Yes | — | OAuth public client id for **this** app only |
| `redirectUri` | Yes | — | Exact callback URL registered on the server |
| `platform` | No | `"web"` | Sent on device register / authorize |
| `appVersion` | No | — | Sent on device register |
| `scope` | No | `openid profile email` | Authorize scope |
| `deviceStorage` | No | `localStorage` | `localStorage` or `indexedDB` for `device_id` |
| `tokenDelivery` | No | `auto` | `auto` → cookie (browser web), `cookie`, or `body` (JSON RT) |
| `tokenStorage` | No | `sessionStorage` | Only when `tokenDelivery: "body"` — where AT+RT persist |
| `apiAudience` | No | — | Client-side hint only; API server enforces audience |
| `refreshSkewSeconds` | No | `60` | Refresh this many seconds before access token expiry |

**`issuer`** is the full public base URL of `createAuthRouter`, **including any mount path** (e.g. `https://auth.example.com` or `http://localhost:3000/auth`). It is **not** your business API URL unless you colocate auth and API on one host.

Keep `config` referentially stable (e.g. `useMemo` or module-level constant) so `AuthProvider` does not recreate the client every render.

```ts
import type { AuthReactConfig } from "@uids-io/auth-react";

export const authConfig: AuthReactConfig = {
  issuer: import.meta.env.VITE_AUTH_ISSUER,
  clientId: import.meta.env.VITE_AUTH_CLIENT_ID,
  redirectUri: import.meta.env.VITE_AUTH_REDIRECT_URI,
  platform: "web",
};
```

---

## OAuth client registration

Each React app build uses **one** `clientId` and **one** `redirectUri`, registered on the auth server via `OAuthClientService.upsertPublicClient`. To add another app, register a new public client and redirect URI; only env/config changes in that React project.

For seeded local-dev client IDs, ports, and the included Vite example, see [`examples/vite-example-portal/README.md`](./examples/vite-example-portal/README.md).

---

## Step-by-step integration

### 1. Wrap the app

```tsx
import { AuthProvider } from "@uids-io/auth-react";
import { authConfig } from "./auth/config";

export function AppRoot({ children }: { children: React.ReactNode }) {
  return <AuthProvider config={authConfig}>{children}</AuthProvider>;
}
```

`AuthProvider` on mount: restores the session via `initialize()` (silent refresh when a cookie/body session exists). Device registration runs on first `signIn()`. Call `loadProviders()` from the login page (or set `loadProvidersOnMount`).

### 2. Routing (React Router example)

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | Home | Sign-in button |
| `/auth/callback` | Callback | Exchange `code` for tokens |
| `/dashboard` | Protected | `useRequireAuth()` or manual guard |

See [`examples/vite-example-portal/src/App.tsx`](./examples/vite-example-portal/src/App.tsx).

### 3. Callback page

Use `useAuthCallback` — do not hand-roll `useEffect` + `handleCallback` (unsafe under React Strict Mode).

```tsx
import { useNavigate } from "react-router-dom";
import { useAuthCallback } from "@uids-io/auth-react";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isProcessing, error } = useAuthCallback({
    onSuccess: () => navigate("/dashboard", { replace: true }),
  });

  if (error) return <p>{error.message}</p>;
  return <p>{isProcessing ? "Signing in…" : "Redirecting…"}</p>;
}
```

`useAuthCallback`:

- Strips `?code` / `?state` from the URL synchronously (before any `await`)
- Claims the OAuth redirect transaction once → `POST /token` with PKCE verifier and `X-Uids-Device-Id`
- Replays safely on Strict Mode remount (no second token exchange)

Advanced: call `client.handleCallback(params)` directly only if you also use `clearOAuthRedirectFromUrl()` and understand the [redirect transaction](./docs/OAUTH_REDIRECT_PLAN.md).

OAuth errors in the query string (`?error=...`) throw `OAuthError`.

### 4. Sign-in and sign-out

```tsx
const { signIn, signOut, isAuthenticated, isLoading, user, error } = useAuth();

// Redirects to auth server /authorize → /login (Google, Microsoft, email, etc.)
await signIn();

// Optional custom OAuth state
await signIn({ state: "checkout" });

// POST /logout (HttpOnly refresh cookie or body refresh_token); clears local tokens
await signOut();
```

Login UI lives on the **auth server** — the SDK does not embed provider secrets.

### 5. Protect routes

```tsx
import { useRequireAuth } from "@uids-io/auth-react";

export function DashboardPage() {
  useRequireAuth(); // redirects to signIn when not authenticated
  // ...
}
```

Or check `isAuthenticated` / `isLoading` manually for custom UX.

### 6. Call your API

```ts
import { createAuthFetch, useAuth } from "@uids-io/auth-react";

const { client } = useAuth();

const apiFetch = createAuthFetch(
  () => client.getAccessToken(),
  () => client.refresh(),
  {
    onUnauthorized: () => {
      void client.signIn();
    },
  },
);

const res = await apiFetch("https://api.example.com/me");
```

- Attaches `Authorization: Bearer <access_token>`
- On **401**, refreshes once and retries
- `getAccessToken()` refreshes proactively when the access token is near expiry

Your API must use `requireAuth` with the same `issuer` and `audience` (`API_AUDIENCE` on the auth kit) as the auth server.

### 7. Framework-agnostic client

Use `createAuthClient` without React when needed:

```ts
import { createAuthClient } from "@uids-io/auth-react";

const client = createAuthClient(authConfig);
await client.registerDevice();
await client.signIn(); // full-page redirect
// on callback page:
await client.handleCallback(new URLSearchParams(window.location.search));
const token = await client.getAccessToken();
```

---

## Auth server endpoints used

| Method | Path | SDK usage |
|--------|------|-----------|
| GET | `/.well-known/openid-configuration` | Optional config bootstrap |
| GET | `/.well-known/oauth-providers` | `loadProviders()` |
| POST | `/devices/register` | On first `signIn()` |
| GET | `/authorize` | `signIn()` redirect (PKCE + `device_id`) |
| POST | `/token` | `handleCallback()` |
| POST | `/refresh` | `refresh()` / scheduled refresh |
| POST | `/logout` | `signOut()` (refresh cookie or `{ refresh_token }`) |
| GET | `/devices` | `listDevices()` |
| POST | `/devices/revoke` | `revokeDevice()` |

---

## Local development

### 1. Auth server (sibling repo)

From [`docs/auth`](../auth):

```bash
cd ../auth
cp examples/express-auth-server/.env.example examples/express-auth-server/.env
# set DATABASE_URL, ISSUER=http://localhost:3000, API_AUDIENCE=http://localhost:4000, CSRF_SECRET=...
npm install
npm run build
npx tsx examples/express-auth-server/index.ts
```

Listens on **http://localhost:3000** by default. Seeds OAuth clients for local development (see the [example app README](./examples/vite-example-portal/README.md)).

### 2. API server (optional, for `/me` demo)

```bash
npx tsx examples/express-api-server/index.ts
```

Listens on **http://localhost:4000**. All routes require Bearer tokens except you call `/me` with a valid access token.

### 3. SDK + example app

```bash
cd /path/to/sdk_react
npm install
npm run build

cd examples/vite-example-portal
cp .env.example .env
npm install
npm run dev
```

Or from repo root:

```bash
npm run example:portal
```

Open http://localhost:5173 → **Sign in** → complete login on auth server → dashboard → **GET /api/me** (Vite proxies `/api` → `localhost:4000`).

---

## End-to-end test checklist

Run these with React **Strict Mode enabled** (default in the example app) and the Network tab open.

| # | Flow | Expected |
|---|------|----------|
| 1 | **Cold load (signed out)** | At most one `POST /refresh` if a prior cookie session exists; no duplicate `openid-configuration` |
| 2 | **Login page** | One `GET /.well-known/oauth-providers` when `loadProviders()` runs |
| 3 | **Google sign-in** | Redirect to `{issuer}/authorize?...`; callback hits `{issuer}/token` **once** (no `invalid_grant` reuse) |
| 4 | **Callback URL** | `?code` stripped from address bar before exchange completes |
| 5 | **Dashboard** | `useRequireAuth` does not loop; user claims visible from ID token |
| 6 | **API call** | `GET /api/me` returns 200 with Bearer token |
| 7 | **Page refresh (F5)** | Session restored via silent `POST /refresh`; still authenticated |
| 8 | **Sign out** | `POST /logout` returns 200 (no `csrf_failed` with cookie delivery + updated auth server) |
| 9 | **After logout** | Protected routes redirect to sign-in; `/me` returns 401 without manual token |
| 10 | **Re-login** | Full OAuth flow works again after sign-out |

**Cross-origin local dev (`localhost:5173` → `localhost:3000`):** cookie refresh may not persist across reload unless you proxy auth under the app origin or use `VITE_AUTH_TOKEN_DELIVERY=body` in `.env`. See [TOKEN_STORAGE.md](./docs/TOKEN_STORAGE.md).

---

## Security defaults

| Topic | Behavior |
|-------|----------|
| `device_id` | SDK-generated UUID v4 — **no browser fingerprinting** |
| Access token | **Memory only** (short-lived) |
| Refresh token (web) | **HttpOnly cookie** on auth issuer — not readable from JS |
| Multi-tab | Refresh leader (`navigator.locks`) + `BroadcastChannel` |
| `tokenDelivery: "body"` | JSON refresh token in storage (local dev / Flutter web) |
| PKCE verifier | `sessionStorage` until callback, then deleted |

Full detail: [docs/TOKEN_STORAGE.md](./docs/TOKEN_STORAGE.md).

---

## Errors

| Class | When |
|-------|------|
| `OAuthError` | `{ error, error_description }` from auth server |
| `ValidationError` | HTTP 422 with `details[]` |
| `TokenReuseError` | `invalid_grant` with reuse/revoked message — tokens cleared |
| `AuthSdkError` | Other failures |

```ts
import { isOAuthError, isTokenReuseError } from "@uids-io/auth-react";

try {
  await client.refresh();
} catch (e) {
  if (isTokenReuseError(e)) {
    await client.signIn();
  }
}
```

---

## API reference

Full JSDoc (parameters, throws, examples) is on the TypeScript types — open `src/auth-client/` or hover `createAuthClient` in your IDE after `npm run build`.

### `createAuthClient(config)` → `AuthClient`

| Method | Description |
|--------|-------------|
| `getDeviceId()` | UUID from storage (creates if missing) |
| `registerDevice()` | `POST /devices/register` |
| `signIn(options?)` | PKCE + redirect to `/authorize` |
| `handleCallback(urlOrParams)` | Exchange code, store tokens |
| `refresh()` | Rotate refresh token |
| `getAccessToken()` | Returns token; refreshes if near expiry |
| `signOut()` | Logout + clear local state |
| `listDevices()` | Authenticated device list |
| `revokeDevice(deviceId)` | Revoke a device |
| `onTokensChanged(cb)` | Subscribe; called immediately with current tokens |
| `loadProviders()` | Fetch and cache `GET /.well-known/oauth-providers` |
| `initialize()` | Restore session via silent refresh on load |

### React exports

| Export | Role |
|--------|------|
| `AuthProvider` | Owns `AuthClient`, session bootstrap, token subscription |
| `useAuth()` | `isAuthenticated`, `user`, `loadProviders`, `signIn`, `signOut`, `client`, `error` |
| `useAuthCallback()` | Canonical OAuth callback route hook (Strict Mode safe) |
| `useRequireAuth()` | Auto `signIn()` when unauthenticated after load |
| `createAuthFetch()` | Bearer + 401 retry for resource APIs |
| `getOrCreateAuthClient()` | Stable client instance across React remounts |

### Advanced

- `buildAuthorizeUrl`, `generatePkcePair` — custom redirects or tests
- `OAuthError`, `TokenReuseError`, `ValidationError` — typed errors from auth HTTP

---

## Package development

```bash
npm install      # installs Husky git hooks (prepare)
npm run build
npm test
npm run typecheck
npm run check    # biome (format + lint + organize imports)
npm run validate # check:ci + typecheck + test + build (same as pre-push hook)
```

**Git hooks (Husky):** `pre-commit` runs Biome on staged files; `pre-push` runs `npm run validate`. Skip with `git commit --no-verify` / `git push --no-verify`, or `HUSKY=0` (CI release job already sets this).

Releases on **`main`** use **semantic-release** — see [RELEASING.md](RELEASING.md). Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, etc.) so version bumps and npm publish happen automatically.

---

## Roadmap

| Phase | Status |
|-------|--------|
| Phase 1 — Core client + React hooks | Shipped in this repo |
| Phase 2 — Multi-tab refresh leader, app presets | Planned |
| Phase 3 — `@uids-io/auth-react/next` | Planned |

Details: [REACT_SDK_PLAN.md](../auth/docs/REACT_SDK_PLAN.md)

---

## License

MIT
