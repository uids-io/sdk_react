# Login providers (Google, Microsoft, email)

Client apps do **not** integrate Google/Microsoft SDKs. The **auth server** hosts IdP flows; the React SDK discovers what is enabled and can start login for a specific provider.

## Discovery endpoint

```http
GET {issuer}/.well-known/oauth-providers
```

Example response:

```json
{
  "issuer": "https://auth.example.com",
  "providers": [
    { "id": "google", "enabled": true },
    { "id": "microsoft", "enabled": false },
    { "id": "email", "enabled": true }
  ]
}
```

`enabled` reflects auth server config (`providers.google`, `providers.microsoft`; email is always available).

## SDK API

| API | Purpose |
|-----|---------|
| `client.getProviders()` | Fetch (cached) provider list |
| `useAuth().providers` | Full response in React |
| `useAuth().enabledProviders` | `["google", "email"]` etc. |
| `signIn()` | Default → auth server `/login` chooser |
| `signIn({ provider: "google" })` | PKCE + redirect straight to Google (if enabled) |

## Sign-in UI example

```tsx
function SignInPage() {
  const { enabledProviders, signIn, isLoading } = useAuth();

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      {enabledProviders.includes("google") && (
        <button type="button" onClick={() => signIn({ provider: "google" })}>
          Continue with Google
        </button>
      )}
      {enabledProviders.includes("microsoft") && (
        <button type="button" onClick={() => signIn({ provider: "microsoft" })}>
          Continue with Microsoft
        </button>
      )}
      {enabledProviders.includes("email") && (
        <button type="button" onClick={() => signIn({ provider: "email" })}>
          Sign in with email
        </button>
      )}
      <button type="button" onClick={() => signIn()}>
        Other options
      </button>
    </div>
  );
}
```

## Flow with `provider: "google"`

```text
signIn({ provider: "google" })
  → GET /authorize?...&login_provider=google
  → auth server saves PKCE pending state
  → redirect to Google (on auth domain)
  → … user signs in …
  → your app /auth/callback?code=...
  → handleCallback()
```

Same PKCE + callback path as generic `signIn()`.

## Auth server setup

Enable providers in `createAuthKit`:

```ts
providers: {
  google: { clientId, clientSecret, callbackUrl: `${ISSUER}/oauth/google/callback` },
  microsoft: { ... },
},
```

Without `google` in config, `enabled: false` and `signIn({ provider: "google" })` throws `OAuthError` (`provider_not_configured`).

## Flutter / other SDKs

Call the same `/.well-known/oauth-providers` endpoint and pass `login_provider` on `/authorize` when implementing native clients.
