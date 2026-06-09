# @advcomm/uids-io-auth-react — architecture

For **token storage, cookies, and multi-tab behavior** read [TOKEN_STORAGE.md](./TOKEN_STORAGE.md) first.

For the **OAuth redirect / callback fix** (transaction state, `useAuthCallback`, removal of `onceInflight`), see [OAUTH_REDIRECT_PLAN.md](./OAUTH_REDIRECT_PLAN.md).

## Layer overview

```
┌─────────────────────────────────────────────────────────────┐
│  React: AuthProvider, useAuth, useRequireAuth               │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  AuthClient — orchestration + TabCoordinator                │
└─┬─────────┬─────────────┬──────────────┬────────────────────┘
  │         │             │              │
  ▼         ▼             ▼              ▼
 PKCE   Token storage   AuthApi      createAuthFetch
        cookie | body    + credentials
```

| Path | Responsibility |
|------|----------------|
| `src/auth-client/` | Public API — `create-client`, `session-controller`, `exchange-callback`, `sign-in` |
| `src/client-registry.ts` | `getOrCreateAuthClient` — stable instance across remounts |
| `src/storage/oauth-redirect-storage.ts` | PKCE redirect transaction (claim / complete) |
| `src/oauth/parse-redirect.ts` | Parse + strip callback URL; session snapshot |
| `src/react/use-auth-callback.ts` | Canonical OAuth callback route hook |
| `src/config/resolve-token-delivery.ts` | `auto` → cookie (web) or body |
| `src/storage/token-storage-cookie.ts` | AT/ID in memory; RT via HttpOnly cookie |
| `src/storage/token-storage-body.ts` | Full token set in browser storage |
| `src/sync/tab-coordinator.ts` | Lock + BroadcastChannel for rotation |
| `src/http/auth-api.ts` | Fetch to auth server; delivery header |

## Login flow

1. `signIn()` → starts redirect transaction (PKCE + state) → redirect to auth server  
2. Callback route → `useAuthCallback` strips `?code` from URL → `handleCallback()` claims transaction once  
3. `POST /token` with `X-Uids-Token-Delivery: cookie` (web)  
4. Server returns access token (+ id token); sets `uids_refresh_token` cookie  
5. SDK stores AT in memory, marks transaction `completed`, schedules refresh  

Strict Mode / remount: second callback invocation reads `completed` transaction or awaits the in-flight exchange — **no second** `POST /token`. See [OAUTH_REDIRECT_PLAN.md](./OAUTH_REDIRECT_PLAN.md).

## Cold start (after F5)

1. `initialize()` — memory empty  
2. Session flag set → `POST /refresh` with `credentials: include` (cookie only)  
3. New AT in memory; timer rescheduled  

## Logout

`signOut()` → clear memory + flag → `POST /logout` (cookie) → broadcast `session-cleared` to all tabs.

## Server contract

Auth package supports cookie delivery via `X-Uids-Token-Delivery: cookie`. See [sdk-contract.md](../../auth/docs/sdk-contract.md) and `src/oauth/refreshCookie.ts` in the auth repo.
