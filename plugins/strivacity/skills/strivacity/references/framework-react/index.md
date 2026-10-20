# Strivacity React Integration

Add Strivacity OIDC (PKCE) login to a client-rendered React app (Vite, CRA, or similar) with `@strivacity/sdk-react` v4.

## Critical rules

- **Ask before creating or editing `.env` files**, and never read an existing `.env` / `.env.local` into context without explicit permission. They may hold real tenant credentials. Tell the user which variables to add instead.
- **This is a public PKCE client.** Never put a client secret (or any BFF `cookieSecret`) in browser code or in a `VITE_` / `REACT_APP_` variable. Everything with those prefixes is shipped to the browser.
- **v4 is a prerelease on the npm `next` dist-tag** (versions like `4.0.0-beta.x`). `npm install @strivacity/sdk-react` without a tag installs v3, which has a different API. Install with `@next` or an explicit 4.x version and pin it exactly.
- **Import from `@strivacity/sdk-react` only.** It re-exports everything from `@strivacity/sdk-core` (flows, storages, errors, utils, types). Do not add `@strivacity/sdk-core` as a direct dependency.
- **Render exactly one `<StyAuthProvider>`** at the app root. The SDK instance is a module-level singleton created once on mount, so changing `options` after the first render has no effect.
- **Pick the mode first.** The quick start uses `mode: 'redirect'`. Mode-specific UI is covered by a separate mode reference loaded next to this one. Only the `mode` value and the login UI change between modes.

## Prerequisites

- React `>=18` (the `react` peer dependency of `@strivacity/sdk-react`) and a client-side router (examples use `react-router`).
- A Strivacity application in the Admin Console:
  - `redirect` / `popup` mode: client type **"OIDC using no-code components"**.
  - `embedded` / `native` mode: client type **"OIDC using the Journey Flow API"**.
- The exact redirect URI (for example `http://localhost:5173/callback`) registered on that client, plus any post-logout redirect URI you pass to `logout()`.
- The issuer URL (`https://<your-cluster-domain>`) and the client ID.

## When NOT to use

- Next.js (App Router or Pages Router): use the Next.js integration (`@strivacity/sdk-next`).
- Preact: use the Preact integration (`@strivacity/sdk-preact`). Same API, different package.
- Remix / React Router framework mode with SSR, SolidStart, SvelteKit, Nuxt, Vue, Angular: use the matching framework integration (Solid, Svelte, Nuxt, Vue, Angular).
- React Native: not supported by this package.
- Server-only token handling (tokens must never reach the browser): pair this SPA with a BFF. See the server-session reference.

## Quick start

### 1. Install

```bash
npm install @strivacity/sdk-react@next
# or pin the exact version you tested, e.g.
npm install --save-exact @strivacity/sdk-react@4.0.0-beta.1
```

### 2. Environment variables

Vite only exposes variables prefixed with `VITE_` (CRA uses `REACT_APP_` and `process.env`). Ask the user before writing these:

```bash
# .env.local
VITE_STRIVACITY_ISSUER="https://<your-cluster-domain>"
VITE_STRIVACITY_CLIENT_ID="<your-client-id>"
VITE_STRIVACITY_REDIRECT_URI="http://localhost:5173/callback"
VITE_STRIVACITY_SCOPES="openid profile email"
```

None of these is secret. They identify a public client.

### 3. Provider

`mode` is the only line that changes when the mode reference says so.

```tsx
// src/auth.tsx
import type { ReactNode } from 'react';
import type { SDKInitConfig } from '@strivacity/sdk-react';
import { StyAuthProvider } from '@strivacity/sdk-react';

export const authOptions: SDKInitConfig = {
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native' - chosen separately
	issuer: import.meta.env.VITE_STRIVACITY_ISSUER,
	clientId: import.meta.env.VITE_STRIVACITY_CLIENT_ID,
	redirectUri: import.meta.env.VITE_STRIVACITY_REDIRECT_URI,
	scopes: (import.meta.env.VITE_STRIVACITY_SCOPES ?? 'openid').split(' '),
	// Server-managed sessions (BFF) only, see the last Quick start subsection:
	// serverSessionUri: '/auth/login',
};

export function AuthProvider({ children }: { children: ReactNode }) {
	return <StyAuthProvider options={authOptions}>{children}</StyAuthProvider>;
}
```

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth';
import { Header } from './Header';
import Callback from './pages/Callback';
import Profile from './pages/Profile';
import Login from './pages/Login';

const Home = () => <h1>Home</h1>;

createRoot(document.getElementById('root')!).render(
	<BrowserRouter>
		<AuthProvider>
			<Header />
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/login" element={<Login />} />
				<Route path="/callback" element={<Callback />} />
				<Route path="/profile" element={<Profile />} />
			</Routes>
		</AuthProvider>
	</BrowserRouter>,
);
```

### 4. Login, register, logout UI

Wait for `loading === false` before calling any SDK method or touching `sdk`. The instance is created in the provider's effect, so it is `undefined` during the first render.

```tsx
// src/Header.tsx
import { useStrivacity } from '@strivacity/sdk-react';

export function Header() {
	const { loading, isAuthenticated, idTokenClaims, login, register, logout } = useStrivacity();

	if (loading) {
		return null;
	}

	return (
		<header>
			{isAuthenticated ? (
				<>
					<span>Hello, {idTokenClaims?.given_name ?? idTokenClaims?.sub}</span>
					<button onClick={() => void logout({ postLogoutRedirectUri: window.location.origin })}>Log out</button>
				</>
			) : (
				<>
					<button onClick={() => void login()}>Log in</button>
					<button onClick={() => void register()}>Sign up</button>
				</>
			)}
		</header>
	);
}
```

`withAuthGuard` redirects unauthenticated users to `/login` by default, so provide that route:

```tsx
// src/pages/Login.tsx
import { useEffect } from 'react';
import type { RedirectFlow } from '@strivacity/sdk-react';
import { useStrivacity } from '@strivacity/sdk-react';

export default function Login() {
	const { loading, login } = useStrivacity<RedirectFlow>();

	useEffect(() => {
		if (!loading) {
			void login();
		}
	}, [loading, login]);

	return <p>Redirecting to login...</p>;
}
```

### 5. Callback route

The route at `redirectUri` must call `handleCallback()`. It validates `state`, exchanges the code with PKCE, verifies the ID token and stores the session. Popup mode needs this route too: inside the popup, `handleCallback()` posts the result back to the opener window.

```tsx
// src/pages/Callback.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity } from '@strivacity/sdk-react';

export default function Callback() {
	const { loading, handleCallback } = useStrivacity();
	const navigate = useNavigate();

	useEffect(() => {
		if (loading) {
			return;
		}

		const params = new URLSearchParams(window.location.search);

		if (params.get('error')) {
			void navigate(`/?error=${encodeURIComponent(params.get('error_description') ?? params.get('error')!)}`, { replace: true });
			return;
		}

		handleCallback()
			.then(() => navigate('/profile', { replace: true }))
			.catch((error: unknown) => navigate(`/?error=${encodeURIComponent(error instanceof Error ? error.message : 'Login failed')}`, { replace: true }));
	}, [loading]);

	return <p>Logging in...</p>;
}
```

### 6. Protected route

`withAuthGuard` waits for loading, calls `checkAuthentication()` (refreshing if needed), and sets `window.location.href` to `loginPageUri` when the user is not authenticated. That is a full page load, not a router navigation. Server-managed (BFF) exception: with `serverSessionUri` set and a session present that is no longer authenticated (expired), it calls `sdk.refresh()` instead, which navigates to `` `${authUrlPrefix}/refresh?returnTo=<current URL>` `` so the BFF rotates the cookie and comes back.

```tsx
// src/pages/Profile.tsx
import { withAuthGuard, useStrivacity } from '@strivacity/sdk-react';

function Profile() {
	const { idTokenClaims, accessTokenExpirationDate } = useStrivacity();

	return (
		<section>
			<h1>{idTokenClaims?.email}</h1>
			<pre>{JSON.stringify(idTokenClaims, null, 2)}</pre>
			<p>Access token expires at {accessTokenExpirationDate ? new Date(accessTokenExpirationDate * 1000).toISOString() : 'n/a'}</p>
		</section>
	);
}

export default withAuthGuard(Profile, { loginPageUri: '/login', onLoading: () => <p>Loading...</p> });
```

### 7. Reading claims and the access token

`useStrivacity()` gives plain reactive values: `idTokenClaims` (decoded, verified ID token claims, or `null`), `accessToken`, `refreshToken`, `accessTokenExpired` and `accessTokenExpirationDate` (Unix seconds). Components re-render when the session changes. For a value that must be fresh right now (such as an outgoing request), use `sdk.accessToken` after `await checkAuthentication()`. See Patterns below.

### Other modes in React (summary)

- `popup`: same provider and hooks. `login()` / `register()` resolve once the popup finishes. Call them from a click handler, or guard with a `useRef` against StrictMode double-invocation. They reject with `PopupBlockedError` or `PopupClosedError`. Keep the `/callback` route. `logout()` does not open a popup: it navigates the main window to the IdP end-session endpoint, like redirect mode.
- `embedded`: render `<sty-login>`, `<sty-notifications>` and `<sty-language-selector>` (JSX types ship with the package). Load the elements with ``injectScript('sty-components', `${issuer}/assets/components/bundle.js`)`` and listen for `login` / `close` / `error` DOM events on the element.
- `native`: `useNativeLogin({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })` returns `{ loading, state, forms, messages, submitForm, setFormValue, setMessage, triggerFallback, triggerClose }`. You render `state.forms` / `state.layout` yourself. Child widgets can read the same context with `useNativeLoginContext()`. In `onFallback`, redirect to `error.url`.
- Externally started flows (password reset links and similar) in embedded/native: an `/entry` route calls `entry()` and forwards the returned params to your login page.

### Server-managed sessions (BFF) in one paragraph

Set `serverSessionUri` to your BFF login endpoint (for example `'/auth/login'`). `login()` then navigates to that endpoint, the BFF performs the code exchange, and tokens stay server-side in encrypted http-only cookies. The SDK stops reading and writing browser storage. The `/callback` route must forward the query string to the BFF (`window.location.href = '/auth/callback' + window.location.search`) instead of calling `handleCallback()`, and logout becomes a navigation to `/auth/logout`. Fetch the session from your BFF before rendering and pass it as `<StyAuthProvider session={session}>`, without `refresh_token` and `id_token` (have the endpoint return `toClientSession(session)`; refresh and logout run on the BFF, and `idTokenClaims` comes from the session's `claims`). The browser never refreshes in this mode: `refresh()` and `withAuthGuard` send an expired session through the BFF refresh route `` `${authUrlPrefix}/refresh` `` (full-page navigation, back to the current URL). `authUrlPrefix` defaults to `'/auth'`; set it only if the BFF uses a different prefix. The default (`null` / `false`) keeps tokens in the browser. The server-session reference covers the BFF side.

## Common mistakes

| Mistake                                                             | Fix                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install @strivacity/sdk-react` installs v3                     | Install `@strivacity/sdk-react@next` or an exact `4.x` version, and pin it                                                                                                                                                                                            |
| `import.meta.env.STRIVACITY_ISSUER` is `undefined`                  | Vite needs the `VITE_` prefix (CRA: `REACT_APP_` via `process.env`). Restart the dev server after editing env files                                                                                                                                                   |
| `redirect_uri` mismatch error from Strivacity                       | `redirectUri` must match the Admin Console entry exactly (scheme, host, port, path, trailing slash)                                                                                                                                                                   |
| Hosted page errors, or embedded/native session start fails          | Client type must match mode: redirect/popup need "OIDC using no-code components"; embedded/native need "OIDC using the Journey Flow API"                                                                                                                              |
| User returns to `/callback` and nothing happens                     | The route at `redirectUri` must call `handleCallback()` once `loading` is false                                                                                                                                                                                       |
| `Cannot read properties of undefined` on `sdk.options`              | `sdk` is `undefined` until the provider's effect runs. Gate every SDK call on `!loading`                                                                                                                                                                              |
| `subscribeToEvent` in a child's mount effect throws                 | Child effects run before the provider's effect. Subscribe inside an effect gated on `!loading`                                                                                                                                                                        |
| `Missing SDK context`                                               | `useStrivacity()` / `withAuthGuard` used outside `<StyAuthProvider>`                                                                                                                                                                                                  |
| `login` fires twice in dev (popup opens twice)                      | React StrictMode re-runs effects. Use a `useRef` guard or trigger login from a click                                                                                                                                                                                  |
| Using `refreshToken` / `refresh()` and getting `null` / errors      | A refresh token is only issued if the client and scopes allow it (often `offline_access`). Check `refreshToken !== null`                                                                                                                                              |
| Logout lands on a Strivacity error page                             | Register the `postLogoutRedirectUri` value on the client                                                                                                                                                                                                              |
| Importing from `@strivacity/sdk-core`                               | Import everything from `@strivacity/sdk-react`, which re-exports core                                                                                                                                                                                                 |
| Putting a client secret or BFF `cookieSecret` in a `VITE_` variable | Never. The SPA is a public PKCE client and the BFF secret belongs on the server only                                                                                                                                                                                  |
| `withAuthGuard` does not return to the original page                | It appends the current path as `returnTo` to `loginPageUri`. On the login page pass it on: `login({ returnTo: new URLSearchParams(location.search).get('returnTo') ?? undefined })`; the callback page navigates to `(await handleCallback()).returnTo ?? '/profile'` |

## API quick reference

### `<StyAuthProvider>` props

| Prop       | Type                  | Notes                                                                        |
| ---------- | --------------------- | ---------------------------------------------------------------------------- |
| `options`  | `SDKInitConfig`       | Required. `mode`, `issuer`, `clientId`, `redirectUri` are required inside it |
| `session`  | `SessionData \| null` | Optional pre-fetched session (BFF mode)                                      |
| `children` | `ReactNode`           | Required                                                                     |

### `useStrivacity<Flow>()` return value (`SDKContext`)

State: `sdk`, `loading`, `language`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired`, `accessTokenExpirationDate`.

Methods (proxied to `sdk`): `login(params?)`, `register(params?)`, `logout({ postLogoutRedirectUri }?)`, `handleCallback(url?)`, `refresh({ returnTo }?)` (server-managed: navigates to `` `${authUrlPrefix}/refresh` ``; `returnTo` defaults to the current URL), `revoke()`, `checkAuthentication({ autoRefresh }?)`, `init()`, `tokenExchange(params?)`, `entry(url?, params?)`, `subscribeToEvent(name, cb)`, `subscribeToAllEvents(cb)`.

Pass the flow type for typed params: `useStrivacity<RedirectFlow>()`, `PopupFlow`, `EmbeddedFlow`, `NativeFlow`.

### `withAuthGuard(Component, options?)`

| Option         | Default        | Notes                                                                                                                          |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `loginPageUri` | `'/login'`     | Target of `window.location.href` when unauthenticated. Server-managed: an expired session goes through `sdk.refresh()` instead |
| `onLoading`    | renders `null` | Rendered while loading or checking                                                                                             |

### Key SDK options (`SDKInitConfig`)

| Option                                        | Default                                    | Notes                                                                                                                                        |
| --------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                                        | required (`'redirect'` documented default) | `'redirect' \| 'popup' \| 'embedded' \| 'native'`                                                                                            |
| `issuer`                                      | required                                   | `https://<your-cluster-domain>` (trailing slash stripped)                                                                                    |
| `clientId`                                    | required                                   |                                                                                                                                              |
| `redirectUri`                                 | required                                   | Must be registered on the client                                                                                                             |
| `scopes`                                      | `['openid']`                               | Add `profile`, `email`, etc.                                                                                                                 |
| `responseType`                                | `'code'`                                   |                                                                                                                                              |
| `responseMode`                                | `'query'`                                  | or `'fragment'`                                                                                                                              |
| `storage`                                     | `createLocalStorage()`                     | Also `createSessionStorage()`, `createMemoryStorage()`, `createIndexedDBStorage()`, `createCacheAPIStorage()`, `createWorkerStorage(worker)` |
| `stateStorage`                                | `createSessionStorage()`                   | PKCE/state storage                                                                                                                           |
| `storageTokenName`                            | `'sty.session'`                            | Storage key for the session                                                                                                                  |
| `autoRefresh`                                 | `true`                                     | Refresh during `checkAuthentication()`                                                                                                       |
| `refreshSkew`                                 | `60`                                       | Seconds before expiry that count as expired                                                                                                  |
| `lazyLoad`                                    | `false`                                    | `true` defers `init()` until first use                                                                                                       |
| `serverSessionUri`                            | `null`                                     | String = BFF login URL; `true` = server-managed without BFF routing                                                                          |
| `authUrlPrefix`                               | `'/auth'`                                  | Server-managed: `refresh()` / `withAuthGuard` navigate to `${authUrlPrefix}/refresh`. Change it only to match a non-default BFF prefix       |
| `discoveryDocumentCacheTTL`                   | `3600`                                     | Seconds                                                                                                                                      |
| `jwksCacheTTL`                                | `600`                                      | Seconds                                                                                                                                      |
| `logging`                                     | none                                       | `createDefaultLogging()` for console logs                                                                                                    |
| `httpClient`, `urlHandler`, `callbackHandler` | built-in                                   | Override for custom navigation (for example Capacitor)                                                                                       |

### `login()` / `register()` params (`ExtraRequestArgs`)

`prompt`, `display`, `loginHint`, `acrValues: string[]`, `uiLocales: string[]` and `audiences: string[]`. `register()` is `login()` with `prompt: 'create'`. Redirect mode adds `locationMethod: 'assign' | 'replace'` and `targetWindow: 'self' | 'top'`. Popup mode adds `popupWindowFeatures`, `popupWindowTarget` and `checkOrigin`.

```ts
await login({ loginHint: 'user@example.com', acrValues: ['urn:strivacity:loa:2'], audiences: ['https://api.example.com'], uiLocales: ['en-US'] });
```

## Patterns

### Call a protected API with the access token

```tsx
import { useStrivacity } from '@strivacity/sdk-react';

export function useApi() {
	const { sdk, checkAuthentication } = useStrivacity();

	return async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
		// Refreshes first if the token is within refreshSkew of expiring (autoRefresh)
		if (!(await checkAuthentication())) {
			throw new Error('Not authenticated');
		}

		const headers = new Headers(init.headers);
		headers.set('Authorization', `Bearer ${sdk.accessToken}`);

		return fetch(input, { ...init, headers });
	};
}
```

Request the API's audience at login (`audiences: ['https://api.example.com']`) if your API validates `aud`.

### Subscribe to SDK events

Event names: `init`, `sessionLoaded`, `loginInitiated`, `flowInitiated`, `loggedIn`, `sessionUpdated`, `tokenRefreshed`, `tokenRefreshFailed`, `accessTokenExpired`, `tokenRevoked`, `tokenRevokeFailed`, `logoutInitiated`, `sessionCleared`.

```tsx
import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-react';

export function SessionWatcher() {
	const { loading, subscribeToEvent } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		const refreshed = subscribeToEvent('tokenRefreshed', (params) => console.info('token refreshed', params?.claims?.sub));
		const failed = subscribeToEvent('tokenRefreshFailed', () => {
			window.location.href = '/login';
		});

		return () => {
			refreshed.dispose();
			failed.dispose();
		};
	}, [loading]);

	return null;
}
```

### Token refresh

There is no background timer. With `autoRefresh: true` (default), `checkAuthentication()` refreshes once the access token is within `refreshSkew` seconds (default `60`) of expiry and a refresh token exists. With `serverSessionUri` set it never refreshes in the browser: `refresh()` (and `withAuthGuard` for an expired session) navigates to the BFF's refresh route (`` `${authUrlPrefix}/refresh` ``, default `/auth/refresh`), which rotates the cookie and redirects back. It runs when `withAuthGuard` mounts, when the provider recomputes `isAuthenticated` after SDK events, and whenever you call it. Call `refresh()` to force a refresh. If an expired access token is still in the session afterwards (no refresh token, or a transient refresh failure), `checkAuthentication()` returns `false`. On failure `tokenRefreshFailed` fires, and the session is cleared unless the failure was a transient `NetworkError` / `ServerError`. `revoke()` revokes the tokens and clears the local session without visiting the IdP logout page.

### Logout

```tsx
const { logout } = useStrivacity();
// Clears local session, then navigates to the IdP end-session endpoint with id_token_hint
await logout({ postLogoutRedirectUri: `${window.location.origin}/` });
```

Without `postLogoutRedirectUri` the user stays on the Strivacity logout page. If there is no ID token, the local session is still cleared but no redirect happens.

Further reading: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-react and https://docs.strivacity.com
