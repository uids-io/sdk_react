# OAuth redirect handling — implementation plan

This document is the reference plan for fixing duplicate callback requests (React Strict Mode, remounts, and concurrent `handleCallback` calls) in `@uids-io/auth-react`.

**Status:** Implemented (2026-06-04).

**Related docs:**

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module map (will be updated after implementation)
- [TOKEN_STORAGE.md](./TOKEN_STORAGE.md) — refresh cookie + multi-tab refresh
- [sdk-contract.md](../../auth/docs/sdk-contract.md) — server ↔ client HTTP contract

---

## 1. Problem statement

### Symptom

On the OAuth callback route (`/auth/callback`), the SDK sometimes issues **two** `POST /token` requests for the same authorization `code`. The first succeeds; the second fails with:

```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code has already been used"
}
```

The same Strict Mode / double-mount pattern can also duplicate `GET /.well-known/oauth-providers`, `GET /.well-known/openid-configuration`, and `POST /devices/register` on app load.

### Root causes (not symptoms)

| Cause | Why it breaks |
|--------|----------------|
| **Single-use authorization codes** | OAuth 2.0 codes must be exchanged **once**. The server correctly rejects reuse (`tokenService.ts`). |
| **Naive `useEffect` callback** | Portals call `handleCallback` in an effect. React Strict Mode runs effects twice in development. A `cancelled` flag only skips UI updates — it does **not** abort `fetch`. |
| **Code left in the URL** | `?code=…` remains in `window.location` during async work. Remounts re-read the same code and attempt another exchange. |
| **No redirect transaction** | The client has no durable record that a redirect leg was claimed or completed. |
| **Eager `AuthProvider` bootstrap** | Provider mount fetches providers, initializes, and registers device — amplifying duplicate network calls unrelated to the callback bug. |
| **`onceInflight` workaround** | A generic in-flight promise deduper papers over the above without modeling OAuth redirect semantics. **Will be removed.** |

### Design principle

> Fix redirect handling the way production OAuth clients do: **transaction state**, **synchronous URL consumption**, and a **first-class React callback hook** — not global promise deduplication.

---

## 2. Industry alignment

This plan follows patterns used by mature SPA OAuth clients:

| Pattern | Examples | Our approach |
|---------|----------|--------------|
| Redirect transaction in session storage | MSAL interaction status, `oidc-client-ts` user store | `OAuthRedirectStorage` |
| Strip callback params from URL before async exchange | Auth0 SPA, oauth4webapi guidance | `clearOAuthRedirectFromUrl()` |
| Dedicated callback hook / route helper | `react-oidc-context`, Auth0 `onRedirectCallback` | `useAuthCallback` |
| Lazy provider / session bootstrap | Auth0 `checkSession`, MSAL `handleRedirectPromise` | `AuthProvider` options |
| Singleton client per portal config | Most SDK factories | `getOrCreateAuthClient()` |

**Non-goal:** Making `POST /token` idempotent on the server for the same code. That would violate OAuth 2.0 security properties. The client must never send a second exchange for the same code.

---

## 3. Target architecture

### 3.1 Redirect transaction state machine

The redirect leg is a short-lived **transaction** stored in `sessionStorage`, keyed by `clientId`. It survives React Strict Mode remounts within the same tab.

```
signIn()
  └─► transaction: { status: "pending", state, verifier }

callback received
  └─► claimCallback(params)  — only first caller moves pending → claimed
  └─► transaction: { status: "claimed", code, state }

POST /token (once)
  └─► transaction: { status: "completed" }
  └─► clear PKCE / transaction keys, tokens in storage

second handleCallback (Strict Mode / remount)
  └─► transaction already "completed" → return tokens from storage (0 network)
```

#### Transaction statuses

| Status | Meaning |
|--------|---------|
| `pending` | `signIn()` started; user at IdP or redirect in flight |
| `claimed` | Callback params captured; exchange in progress or about to start |
| `completed` | Tokens stored; redirect leg finished |
| `failed` | Terminal error; user must restart sign-in |

#### Transaction shape (sessionStorage)

```typescript
interface RedirectTransaction {
  status: "pending" | "claimed" | "completed" | "failed";
  state: string;
  verifier: string;
  code?: string;
  error?: string;
  claimedAt?: number;
  completedAt?: number;
}
```

PKCE `verifier` and OAuth `state` live **inside** this transaction — not as separate ad-hoc sessionStorage keys.

### 3.2 Synchronous URL consumption

Before any `await`, the callback route must:

1. Parse `code`, `state`, `error` from the URL.
2. Call `history.replaceState` to remove query params from the address bar.

Remounts then do not see a “fresh” authorization code in `window.location`.

```typescript
// New utilities (exported)
parseOAuthRedirect(urlOrSearch: string | URLSearchParams): OAuthRedirectParams;
clearOAuthRedirectFromUrl(fallbackPath?: string): OAuthRedirectParams;
```

`clearOAuthRedirectFromUrl` returns the parsed params **and** strips the query string in one synchronous step.

### 3.3 `handleCallback` flow (framework-agnostic)

```
handleCallback(urlOrParams):
  1. params ← parse (or use pre-parsed params from clearOAuthRedirectFromUrl)
  2. if params.error → throw OAuthError
  3. if no code → throw OAuthError("invalid_request")
  4. if transaction.status === "completed" && tokens exist → return tokens (idempotent)
  5. claim ← transaction.claimCallback({ code, state })
       - validate state matches pending transaction
       - if already completed → return tokens
       - if already claimed with same code → do not POST /token again
  6. POST /token once (code_verifier from transaction)
  7. transaction.markCompleted(); clear transaction; apply tokens
  8. on failure → transaction.markFailed(); throw
```

**Removed:** `onceInflight`, global `callbackExchangeInflight` map.

**Optional (transaction-scoped only):** If status is `claimed` and exchange is in-flight, a single promise stored on the transaction record may be awaited by a concurrent caller in the same tab. This is tied to OAuth state — not a generic deduper.

### 3.4 Layer overview (after implementation)

```
┌──────────────────────────────────────────────────────────────┐
│  React: useAuthCallback, AuthProvider, useAuth               │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  AuthClient — signIn, handleCallback, refresh, signOut       │
└─┬──────────────────┬──────────────────┬────────────────────┘
  │                  │                  │
  ▼                  ▼                  ▼
OAuthRedirectStorage  Token storage    AuthApi + TabCoordinator
(parse + clear URL)   cookie | body    (unchanged)
```

---

## 4. React integration

### 4.1 `useAuthCallback` (new — canonical callback route)

Portals must not hand-roll fragile `useEffect` + `cancelled` patterns. The SDK provides:

```tsx
function CallbackPage() {
  const navigate = useNavigate();
  const { isProcessing, error } = useAuthCallback({
    onSuccess: () => navigate("/dashboard", { replace: true }),
  });

  if (error) return <p>{error.message}</p>;
  return <p>Completing sign-in…</p>;
}
```

Hook responsibilities:

1. Synchronously `clearOAuthRedirectFromUrl()` (or accept pre-cleared params).
2. Call `client.handleCallback(params)` once.
3. Expose `isProcessing` and `error` for UI.

Transaction storage makes Strict Mode remounts safe even if the hook’s effect runs twice.

### 4.2 `AuthProvider` — lazy bootstrap

**Today (problematic):**

```
mount → getProviders() + initialize() + registerDevice()
```

**Proposed defaults:**

| Action | When | Default |
|--------|------|---------|
| `initialize()` | Silent session restore (cookie refresh) | `autoInitialize: true` |
| `registerDevice()` | First `signIn()` only | Not on provider mount |
| `getProviders()` | Login UI needs provider buttons | `loadProvidersOnMount: false` |

New props:

```typescript
interface AuthProviderProps {
  config: AuthReactConfig;
  autoInitialize?: boolean;         // default: true
  loadProvidersOnMount?: boolean;     // default: false
  registerOnMount?: boolean;        // default: false (breaking change from today)
}
```

`isLoading` reflects session restore only — not provider discovery.

Optional: `useAuth().loadProviders()` for login pages.

### 4.3 Stable client instance

Replace `useMemo(() => createAuthClient(config), [config])` with a module-level registry:

```typescript
getOrCreateAuthClient(config: AuthReactConfig): AuthClient
```

Keyed by `normalizeIssuer(issuer) + clientId`. Strict Mode remount must not create a second client with empty in-memory token state when `config` is a module constant.

---

## 5. Implementation checklist

### Phase 1 — Core transaction (framework-agnostic)

| Task | File |
|------|------|
| Add `OAuthRedirectStorage` | `src/storage/oauth-redirect-storage.ts` |
| Add redirect parse/clear helpers | `src/oauth/parse-redirect.ts` |
| Rewrite `signIn()` to `transaction.start()` | `src/auth-client.ts` |
| Rewrite `handleCallback()` with claim/complete | `src/auth-client.ts` |
| Remove `PkceSessionStorage` or fold into transaction | `src/storage/pkce-storage.ts` |
| Unit tests: claim once, replay completed, state mismatch | `tests/unit/oauth-redirect.test.ts`, `tests/unit/handle-callback.test.ts` |

### Phase 2 — React integration

| Task | File |
|------|------|
| Add `useAuthCallback` | `src/react/use-auth-callback.ts` |
| Export from package entry | `src/index.ts` |
| Refactor `AuthProvider` lazy bootstrap + client registry | `src/react/auth-provider.tsx` |
| Add `getOrCreateAuthClient` | `src/auth-client.ts` or `src/client-registry.ts` |
| Update example callback page | `examples/vite-merchant-portal/src/pages/CallbackPage.tsx` |

### Phase 3 — Cleanup

| Task | File |
|------|------|
| Delete `onceInflight` utility | `src/util/inflight.ts` |
| Remove inflight from providers / discovery | `src/oauth/providers.ts`, `src/oauth/openid-discovery.ts` |
| Keep TTL cache on `fetchAuthProviders` (standard HTTP caching) | `src/oauth/providers.ts` |
| Update architecture + README | `docs/ARCHITECTURE.md`, `README.md` |

### Phase 4 — Documentation

| Task | File |
|------|------|
| Mark this plan **implemented** with date | This file |
| Add callback integration guide section | `README.md` |
| Cross-link from architecture | `docs/ARCHITECTURE.md` |

---

## 6. Testing strategy

| Scenario | Expected |
|----------|----------|
| Two concurrent `handleCallback` with same code | One `POST /token`; both callers receive same `TokenSet` |
| Strict Mode double effect | Second call reads `completed` transaction; zero network |
| Remount after successful callback | Tokens returned from storage; zero network |
| Invalid `state` | `invalid_request`; transaction `failed` |
| Missing verifier / expired transaction | Clear error; user restarts `signIn()` |
| `signOut()` | Clears transaction + tokens |
| URL after callback | No `?code=` or `?state=` in address bar |

---

## 7. Server-side assessment (`@advcomm/uids-io-auth`)

### 7.1 Required server changes

**None.** The current auth server already implements correct OAuth 2.0 behavior for this plan:

| Server behavior | Location / notes |
|-----------------|------------------|
| Single-use authorization codes | `tokenService.ts` — rejects reuse with `Authorization code already used` |
| PKCE S256 on `/authorize` and `/token` | Per [sdk-contract.md](../../auth/docs/sdk-contract.md) |
| `POST /token` with `X-Uids-Device-Id` | Contract § OAuth PKCE flow |
| Cookie refresh delivery | `X-Uids-Token-Delivery: cookie` + `uids_refresh_token` HttpOnly cookie |
| `GET /.well-known/oauth-providers` | Provider discovery for login UI |
| `POST /devices/register` | Device binding (optional before login) |

The bug is entirely **client-side**: the SDK must not issue a second `POST /token` for the same code. The server is correct to return `invalid_grant`.

### 7.2 Optional server improvements (not blocking)

These improve efficiency or DX but are **not required** for the redirect transaction implementation:

| Improvement | Benefit | Priority |
|-------------|---------|----------|
| **`Cache-Control` on well-known endpoints** | `GET /.well-known/oauth-providers` and `openid-configuration` could send `Cache-Control: public, max-age=300` to reduce duplicate discovery fetches across remounts | Low |
| **Idempotent device register** | Return `200` with existing device when same `client_id` + `device_id` re-registers (today may always `201`) — harmless if client stops eager register on mount | Low |
| **sdk-contract.md — React redirect section** | Document that React SDK uses session transaction + `useAuthCallback`; Flutter SDK should mirror the same pattern | Medium (docs only) |
| **Structured error code for code reuse** | Already returns `invalid_grant` — ensure message stays stable for client logging | None (already OK) |

### 7.3 Server behaviors the client must respect

| Rule | Client obligation |
|------|-------------------|
| Codes are single-use | Never retry `POST /token` with the same `code` |
| Refresh token rotation | Keep `TabCoordinator` for multi-tab refresh (unchanged) |
| Cookie `credentials: include` | Keep on `/token`, `/refresh`, `/logout` for web delivery |
| `issuer` includes mount path | Full base URL in config (e.g. `http://localhost:3000/auth`) |

---

## 8. Migration notes for portal apps

1. Replace callback `useEffect` with `useAuthCallback`.
2. Set `issuer` to the full auth base URL (including mount path).
3. If relying on `AuthProvider` to preload providers, set `loadProvidersOnMount: true` or call `loadProviders()` on the login page.
4. Remove any local `onceInflight`-style workarounds after upgrading SDK.
5. Strict Mode can remain enabled in development.

### Breaking changes (intentional)

| Change | Migration |
|--------|-----------|
| `registerOnMount` default `false` | Device registers on first `signIn()`; set `registerOnMount: true` to restore old behavior |
| Providers not loaded on mount by default | Call `loadProviders()` or `loadProvidersOnMount: true` |
| `onceInflight` removed | No portal action — internal only |

---

## 9. What we keep unchanged

| Component | Reason |
|-----------|--------|
| `TabCoordinator` | Legitimate multi-tab refresh rotation (server revokes reused RTs) |
| `issuerUrl()` | Correct path building under mounted issuers |
| Cookie / body token delivery split | Web security default per contract |
| `createAuthFetch` | API Bearer helper — unrelated to redirect |

---

## 10. Success criteria

Implementation is complete when:

- [x] No `onceInflight` or global callback dedupe maps remain
- [x] `handleCallback` is idempotent via transaction state, not promise merging
- [x] Callback URL is stripped synchronously before token exchange
- [x] `useAuthCallback` is the documented integration path
- [x] Example app uses `useAuthCallback` (verify Google sign-in under Strict Mode in portal)
- [x] Unit tests cover transaction claim, completion replay, and state validation
- [x] `docs/ARCHITECTURE.md` and `README.md` link to this plan

---

## 11. References

- [OAuth 2.0 Authorization Framework — authorization code](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1)
- [OAuth 2.0 PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [Client SDK Contract](../../auth/docs/sdk-contract.md)
- [TOKEN_STORAGE.md](./TOKEN_STORAGE.md)
- [LOGIN_PROVIDERS.md](./LOGIN_PROVIDERS.md)
