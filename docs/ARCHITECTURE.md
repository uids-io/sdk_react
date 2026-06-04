# @uids-io/auth-react — architecture

For **token storage, cookies, and multi-tab behavior** read [TOKEN_STORAGE.md](./TOKEN_STORAGE.md) first.

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
| `src/auth-client.ts` | Public API, refresh timer, tab sync |
| `src/config/resolve-token-delivery.ts` | `auto` → cookie (web) or body |
| `src/storage/token-storage-cookie.ts` | AT/ID in memory; RT via HttpOnly cookie |
| `src/storage/token-storage-body.ts` | Full token set in browser storage |
| `src/sync/tab-coordinator.ts` | Lock + BroadcastChannel for rotation |
| `src/http/auth-api.ts` | Fetch to auth server; delivery header |

## Login flow

1. `signIn()` → PKCE + redirect to auth server  
2. `handleCallback()` → `POST /token` with `X-Uids-Token-Delivery: cookie` (web)  
3. Server returns access token (+ id token); sets `uids_refresh_token` cookie  
4. SDK stores AT in memory, marks refresh session flag, schedules refresh  

## Cold start (after F5)

1. `initialize()` — memory empty  
2. Session flag set → `POST /refresh` with `credentials: include` (cookie only)  
3. New AT in memory; timer rescheduled  

## Logout

`signOut()` → clear memory + flag → `POST /logout` (cookie) → broadcast `session-cleared` to all tabs.

## Server contract

Auth package supports cookie delivery via `X-Uids-Token-Delivery: cookie`. See [sdk-contract.md](../../auth/docs/sdk-contract.md) and `src/oauth/refreshCookie.ts` in the auth repo.
