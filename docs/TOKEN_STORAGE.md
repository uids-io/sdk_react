# Token storage & multi-tab security

This document explains **critical** client-side decisions in `@uids-io/auth-react`.

## Split storage (web default: `tokenDelivery: "auto"` → cookie)

| Token | Where | Readable by JS? | Survives F5? |
|-------|--------|-----------------|-------------|
| **Access token** | Memory | Yes (short window) | No — restored via silent refresh |
| **ID token** | Memory | Yes (display only) | No |
| **Refresh token** | HttpOnly cookie on **auth issuer** | **No** | Yes (cookie jar on auth origin) |

The auth server sets `uids_refresh_token` when the SDK sends:

```http
X-Uids-Token-Delivery: cookie
```

and **omits** `refresh_token` from the JSON body. The browser sends the cookie automatically on `POST /refresh` and `POST /logout` when `credentials: "include"` is used (SDK does this in cookie mode).

### Boot after page refresh

1. Memory has no access token.
2. `localStorage` flag `uids:refresh_session` (shared across portal tabs) indicates a cookie session may exist.
3. `initialize()` → ask other tabs for tokens via `BroadcastChannel`, else `POST /refresh` with cookie only → new access token in memory.

## Body delivery (`tokenDelivery: "body"`)

Used when:

- `platform` is not `web` (Flutter mobile pattern via future SDK)
- Explicit `tokenDelivery: "body"` in config
- Local dev across **different ports** if cookies are not sent cross-site (see below)

Stores **access + refresh** in `sessionStorage` / `localStorage` per `tokenStorage`. Same HTTP contract as Flutter (`refresh_token` in JSON).

## Multi-tab (new tab + refresh)

**New tab (Ctrl+click):** access token is only in the first tab’s memory. On load, the SDK:

1. Asks other tabs for tokens (`session-request` on `BroadcastChannel`) — fast path, no `/refresh`.
2. If none respond, uses the **localStorage** refresh-session flag and runs silent `POST /refresh` (same as F5).

**Why not `sessionStorage` for the flag?** Each browser tab has its own `sessionStorage`, so a new tab would think you are logged out.

## Multi-tab refresh (rotation-safe)

Your auth server **rotates** refresh tokens. Two tabs refreshing with the same old RT causes **reuse detection** and session revoke.

The SDK prevents that:

1. **`navigator.locks`** — only one tab calls `POST /refresh` at a time.
2. **`BroadcastChannel`** — leader broadcasts new access token (and metadata) to other tabs.
3. Followers update memory and reschedule timers **without** calling `/refresh`.

```text
Tab A (wins lock)     Tab B
    |                    |
    +-- POST /refresh -->|
    |                    | (blocked on lock)
    +-- broadcast AT --->+ apply tokens locally
```

## CORS & cookies (production vs local dev)

Refresh cookies are stored on the **auth issuer** (e.g. `https://auth.example.com`), not the portal origin.

- **Production** (`app.example.com` + `auth.example.com`): same registrable domain → `SameSite=Lax` cookies usually sent on `fetch(..., { credentials: "include" })`.
- **Local dev** (`localhost:5173` → `localhost:3000`): different **sites** (different ports) → cookies may **not** be sent. Use either:
  - `tokenDelivery: "body"` in `.env` for the example app, or
  - Reverse-proxy auth + app under one origin, or
  - Auth server cookie `sameSite: "none"` + `secure: true` (HTTPS dev)

## Sign out

- Clears memory + session flag.
- `POST /logout` with `credentials: "include"` (HttpOnly refresh cookie or body `refresh_token`).
- Cross-origin SPAs cannot read `uids_csrf`; auth server skips CSRF on `/logout` when `uids_refresh_token` cookie is present (same as `/refresh`).
- When auth is same-origin/proxied, SDK also sends `X-CSRF-Token` if `uids_csrf` is readable.
- Server clears `uids_refresh_token` cookie.
- Broadcast `session-cleared` so all tabs logout.

## Threat model summary

| Risk | Mitigation |
|------|------------|
| XSS steals refresh | Cookie mode: RT not in JS |
| XSS steals access | Short TTL + memory-only AT |
| Multi-tab rotation race | Lock + BroadcastChannel |
| CSRF on `/refresh` | `SameSite` cookie policy; RT not in URL |
| Stolen refresh reuse | Server rotation + family revoke (auth package) |

## Server requirements

`@advcomm/uids-io-auth` must support (implemented in auth repo):

- `X-Uids-Token-Delivery: cookie` on `/token` and `/refresh`
- `Set-Cookie: uids_refresh_token=...; HttpOnly; ...`
- `/refresh` accepts cookie **or** body `refresh_token`
- `/logout` clears refresh cookie

Flutter SDK should use **body** delivery only and platform secure storage — no cookie header.
