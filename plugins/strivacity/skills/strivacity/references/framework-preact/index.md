# Strivacity Preact Integration

Add Strivacity OIDC (PKCE) login to a client-rendered Preact app (Vite + `@preact/preset-vite`) with `@strivacity/sdk-preact` v4. The API is the same as `@strivacity/sdk-react` (`StyAuthProvider`, `useStrivacity`, `withAuthGuard`, `useNativeLogin`), but every import comes from the Preact package and hooks come from `preact/hooks`.

## Critical rules

- **Ask before creating or editing `.env` files**, and never read an existing `.env` / `.env.local` into context without explicit permission. They may hold real tenant credentials. Tell the user which variables to add instead.
- **This is a public PKCE client.** Never put a client secret (or any BFF `secret`) in browser code or in a `VITE_` variable. Everything with that prefix is shipped to the browser.
- **v4 is a prerelease on the npm `next` dist-tag** (versions like `4.0.0-beta.x`). `npm install @strivacity/sdk-preact` without a tag installs v3, which has a different API. Install with `@next` or an explicit 4.x version and pin it exactly.
- **Import from `@strivacity/sdk-preact` only.** It re-exports everything from `@strivacity/sdk-core` (flows, storages, errors, utils, types). Do not add `@strivacity/sdk-core` or `@strivacity/sdk-react` as dependencies, and do not alias `react` to `preact/compat` just for this SDK. It is built for Preact directly.
- **Render exactly one `<StyAuthProvider>`** at the app root. The SDK instance is a module-level singleton created once on mount, so changing `options` after the first render has no effect.
- **Pick the mode first.** The quick start uses `mode: 'redirect'`. Mode-specific UI is covered by a separate mode reference loaded next to this one. Only the `mode` value and the login UI change between modes.

## Prerequisites

- Preact `>=10` (the `preact` peer dependency) and a client-side router (examples use `preact-router`; `preact-iso` or `wouter-preact` work the same way).
- A Strivacity application in the Admin Console:
  - `redirect` / `popup` mode: client type **"OIDC using no-code components"**.
  - `embedded` / `native` mode: client type **"OIDC using the Journey Flow API"**.
- The exact redirect URI (for example `http://localhost:5173/callback`) registered on that client, plus any post-logout redirect URI you pass to `logout()`.
- The issuer URL (`https://<your-cluster-domain>`) and the client ID.

## When NOT to use

- React (Vite/CRA): use the React integration (`@strivacity/sdk-react`). Next.js: `@strivacity/sdk-next`.
- Preact with SSR / prerendering where auth state must be known on the server: this package is client-only. Pair the SPA with a BFF (see the last Quick start subsection and the server-session reference).
- SolidStart, SvelteKit, Nuxt, Vue, Angular: use the matching framework integration.

## Quick start

### 1. Install

```bash
npm install @strivacity/sdk-preact@next
# or pin the exact version you tested, e.g.
npm install --save-exact @strivacity/sdk-preact@4.0.0-beta.1
```

### 2. Environment variables

Vite only exposes variables prefixed with `VITE_`. Ask the user before writing these:

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
import type { ComponentChildren } from 'preact';
import type { SDKInitConfig } from '@strivacity/sdk-preact';
import { StyAuthProvider } from '@strivacity/sdk-preact';

export const authOptions: SDKInitConfig = {
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native' - chosen separately
	issuer: import.meta.env.VITE_STRIVACITY_ISSUER,
	clientId: import.meta.env.VITE_STRIVACITY_CLIENT_ID,
	redirectUri: import.meta.env.VITE_STRIVACITY_REDIRECT_URI,
	scopes: (import.meta.env.VITE_STRIVACITY_SCOPES ?? 'openid').split(' '),
	// Server-managed sessions (BFF) only, see the last Quick start subsection:
	// serverSessionUri: '/auth/login',
};

export function AuthProvider({ children }: { children: ComponentChildren }) {
	return <StyAuthProvider options={authOptions}>{children}</StyAuthProvider>;
}
```

```tsx
// src/main.tsx
import { render } from 'preact';
import Router, { Route } from 'preact-router';
import { AuthProvider } from './auth';
import { Header } from './Header';
import Callback from './pages/Callback';
import Login from './pages/Login';
import Profile from './pages/Profile';

const Home = () => <h1>Home</h1>;

render(
	<AuthProvider>
		<Header />
		<Router>
			<Route path="/" component={Home} />
			<Route path="/login" component={Login} />
			<Route path="/callback" component={Callback} />
			<Route path="/profile" component={Profile} />
		</Router>
	</AuthProvider>,
	document.getElementById('app')!,
);
```

### 4. Login, register, logout UI

Wait for `loading === false` before calling any SDK method or touching `sdk`. The instance is created in the provider's effect, so it is `undefined` during the first render.

```tsx
// src/Header.tsx
import { useStrivacity } from '@strivacity/sdk-preact';

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
import { useEffect } from 'preact/hooks';
import type { RedirectFlow } from '@strivacity/sdk-preact';
import { useStrivacity } from '@strivacity/sdk-preact';

export default function Login() {
	const { loading, login } = useStrivacity<RedirectFlow>();

	useEffect(() => {
		if (!loading) {
			void login();
		}
	}, [loading]);

	return <p>Redirecting to login...</p>;
}
```

### 5. Callback route

The route at `redirectUri` must call `handleCallback()`. It validates `state`, exchanges the code with PKCE, verifies the ID token and stores the session. Popup mode needs this route too: inside the popup, `handleCallback()` posts the result back to the opener window.

```tsx
// src/pages/Callback.tsx
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useStrivacity } from '@strivacity/sdk-preact';

export default function Callback() {
	const { loading, handleCallback } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		const params = new URLSearchParams(window.location.search);

		if (params.get('error')) {
			route(`/?error=${encodeURIComponent(params.get('error_description') ?? params.get('error')!)}`, true);
			return;
		}

		handleCallback()
			.then(() => route('/profile', true))
			.catch((error: unknown) => route(`/?error=${encodeURIComponent(error instanceof Error ? error.message : 'Login failed')}`, true));
	}, [loading]);

	return <p>Logging in...</p>;
}
```

### 6. Protected route

`withAuthGuard` waits for loading, calls `checkAuthentication()` (refreshing if needed), and sets `window.location.href` to `loginUri` when the user is not authenticated. That is a full page load, not a router navigation. Server-managed (BFF) exception: with `serverSessionUri` set and a session present that is no longer authenticated (expired), it calls `sdk.refresh()` instead, which navigates to `` `${authUrlPrefix}/refresh?returnTo=<current URL>` `` so the BFF rotates the cookie and comes back.

```tsx
// src/pages/Profile.tsx
import { withAuthGuard, useStrivacity } from '@strivacity/sdk-preact';

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

export default withAuthGuard(Profile, { loginUri: '/login', onLoading: () => <p>Loading...</p> });
```

### 7. Reading claims and the access token

`useStrivacity()` gives plain values that re-render the component when the session changes: `idTokenClaims` (decoded, verified ID token claims, or `null`), `accessToken`, `refreshToken`, `accessTokenExpired` and `accessTokenExpirationDate` (Unix seconds). For a value that must be fresh right now (such as an outgoing request), use `sdk.accessToken` after `await checkAuthentication()`. See Patterns below.

### Other modes in Preact (summary)

- `popup`: same provider and hooks. `login()` / `register()` from `useStrivacity<PopupFlow>()` resolve once the popup finishes. Call them from a click handler so the browser does not block the popup. They reject with `PopupBlockedError` or `PopupClosedError`. Keep the `/callback` route. `logout()` does not open a popup: it navigates the main window to the IdP end-session endpoint, like redirect mode.
- `embedded`: render `<sty-login>`, `<sty-notifications>` and `<sty-language-selector>` (the package augments `preact`'s `JSX.IntrinsicElements` for them). Load the elements with ``injectScript('sty-components', `${issuer}/assets/components/bundle.js`)`` from `@strivacity/sdk-preact`, set `params` / `sessionId` / `shortAppId` / `lang` as DOM properties through a `ref` (type `LoginComponent`), and listen for `login` / `close` / `error` DOM events on the element.
- `native`: `useNativeLogin({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })` returns `{ loading, state, forms, messages, submitForm, setFormValue, setMessage, triggerFallback, triggerClose }`. You render `state.forms` / `state.layout` yourself. Child widgets read the same state with `useNativeLoginContext()` (no provider element needed). In `onFallback`, redirect to `error.url`.
- Externally started flows (password reset links and similar) in embedded/native: an `/entry` route calls `entry()` once `loading` is false and forwards the returned params (`session_id`, `short_app_id`, `language`) to your login page.

### Server-managed sessions (BFF) in one paragraph

Set `serverSessionUri` to your BFF login endpoint (for example `'/auth/login'`, proxied to the BFF in `vite.config.ts` with `server.proxy: { '/auth': 'http://localhost:3000' }`). `login()` then navigates to that endpoint, the BFF performs the code exchange, and tokens stay server-side in encrypted http-only cookies. The SDK stops reading and writing browser storage. The `/callback` route must forward the query string to the BFF (`window.location.href = '/auth/callback' + window.location.search`) instead of calling `handleCallback()`, and logout becomes a navigation to `/auth/logout`. Fetch the session from your BFF before `render()` (for example `await fetch('/auth/session', { credentials: 'include' })`, an endpoint your BFF exposes) and pass it as `<StyAuthProvider session={session}>`, without `refresh_token` and `id_token` (have the endpoint return `toClientSession(session)`; refresh and logout run on the BFF, and `idTokenClaims` comes from the session's `claims`). The browser never refreshes in this mode: `refresh()` and `withAuthGuard` send an expired session through the BFF refresh route `` `${authUrlPrefix}/refresh` `` (full-page navigation, back to the current URL). `authUrlPrefix` defaults to `'/auth'`; set it only if the BFF uses a different prefix. The default (`null` / `false`) keeps tokens in the browser. The server-session reference covers the BFF side.

## Common mistakes

| Mistake                                                        | Fix                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install @strivacity/sdk-preact` installs v3               | Install `@strivacity/sdk-preact@next` or an exact `4.x` version, and pin it                                                                                                                                                                                       |
| Using `@strivacity/sdk-react` through `preact/compat`          | Use `@strivacity/sdk-preact`. Same API, no compat alias needed                                                                                                                                                                                                    |
| `import.meta.env.STRIVACITY_ISSUER` is `undefined`             | Vite needs the `VITE_` prefix. Restart the dev server after editing env files                                                                                                                                                                                     |
| `redirect_uri` mismatch error from Strivacity                  | `redirectUri` must match the Admin Console entry exactly (scheme, host, port, path, trailing slash)                                                                                                                                                               |
| Hosted page errors, or embedded/native session start fails     | Client type must match mode: redirect/popup need "OIDC using no-code components"; embedded/native need "OIDC using the Journey Flow API"                                                                                                                          |
| User returns to `/callback` and nothing happens                | The route at `redirectUri` must call `handleCallback()` once `loading` is false                                                                                                                                                                                   |
| `Cannot read properties of undefined` on `sdk.options`         | `sdk` is `undefined` until the provider's effect runs. Gate every SDK call on `!loading`                                                                                                                                                                          |
| `subscribeToEvent` in a child's mount effect throws            | Child effects run before the provider's effect. Subscribe inside an effect gated on `!loading`                                                                                                                                                                    |
| `Missing SDK context`                                          | `useStrivacity()` / `withAuthGuard` used outside `<StyAuthProvider>`                                                                                                                                                                                              |
| Using `refreshToken` / `refresh()` and getting `null` / errors | A refresh token is only issued if the client and scopes allow it (often `offline_access`). Check `refreshToken !== null`                                                                                                                                          |
| Logout lands on a Strivacity error page                        | Register the `postLogoutRedirectUri` value on the client                                                                                                                                                                                                          |
| Importing from `@strivacity/sdk-core`                          | Import everything from `@strivacity/sdk-preact`, which re-exports core                                                                                                                                                                                            |
| `withAuthGuard` does not return to the original page           | It appends the current path as `returnTo` to `loginUri`. On the login page pass it on: `login({ returnTo: new URLSearchParams(location.search).get('returnTo') ?? undefined })`; the callback page navigates to `(await handleCallback()).returnTo ?? '/profile'` |

## API quick reference

### `<StyAuthProvider>` props

| Prop       | Type                  | Notes                                                                        |
| ---------- | --------------------- | ---------------------------------------------------------------------------- |
| `options`  | `SDKInitConfig`       | Required. `mode`, `issuer`, `clientId`, `redirectUri` are required inside it |
| `session`  | `SessionData \| null` | Optional pre-fetched session (BFF mode)                                      |
| `children` | `ComponentChildren`   | Required                                                                     |

### `useStrivacity<Flow>()` return value (`SDKContext`)

State: `sdk`, `loading`, `language`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired`, `accessTokenExpirationDate`.

Methods (proxied to `sdk`): `login(params?)`, `register(params?)`, `logout({ postLogoutRedirectUri }?)`, `handleCallback(url?)`, `refresh({ returnTo }?)` (server-managed: navigates to `` `${authUrlPrefix}/refresh` ``; `returnTo` defaults to the current URL), `revoke()`, `checkAuthentication({ autoRefresh }?)`, `init()`, `tokenExchange(params?)`, `entry(url?, params?)`, `subscribeToEvent(name, cb)`, `subscribeToAllEvents(cb)`.

Pass the flow type for typed params: `useStrivacity<RedirectFlow>()`, `PopupFlow`, `EmbeddedFlow`, `NativeFlow`.

### Other exports

`withAuthGuard(Component, { loginUri = '/login', onLoading })` (renders `onLoading()` or `null` while checking; server-managed: an expired session goes through `sdk.refresh()` instead of `loginUri`), `useNativeLogin(options)`, `useNativeLoginContext()`, `injectScript(id, src)`, storages (`createLocalStorage`, `createSessionStorage`, `createMemoryStorage`, `createIndexedDBStorage`, `createCacheAPIStorage`, `createWorkerStorage`), `createDefaultLogging()`, `isSessionExpired(session)`, errors (`PopupBlockedError`, `PopupClosedError`, `FallbackError`, ...). Subpath entries `@strivacity/sdk-preact/{components,hooks,types,storages,utils,errors}` exist but the root entry is enough.

### Key SDK options (`SDKInitConfig`)

| Option                                       | Default                                           | Notes                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                                       | required (`'redirect'` documented default)        | `'redirect' \| 'popup' \| 'embedded' \| 'native'`                                                                                      |
| `issuer` / `clientId` / `redirectUri`        | required                                          | `redirectUri` must be registered on the client                                                                                         |
| `scopes`                                     | `['openid']`                                      | Add `profile`, `email`, `offline_access`, etc.                                                                                         |
| `responseType` / `responseMode`              | `'code'` / `'query'`                              | `responseMode` can be `'fragment'`                                                                                                     |
| `storage` / `stateStorage`                   | `createLocalStorage()` / `createSessionStorage()` | Session storage / PKCE+state storage                                                                                                   |
| `storageTokenName`                           | `'sty.session'`                                   | Storage key for the session                                                                                                            |
| `autoRefresh` / `refreshSkew`                | `true` / `60`                                     | Refresh during `checkAuthentication()`; seconds before expiry                                                                          |
| `lazyLoad`                                   | `false`                                           | `true` defers `init()` until first use                                                                                                 |
| `serverSessionUri`                           | `null`                                            | String = BFF login URL; `true` = server-managed without BFF routing                                                                    |
| `authUrlPrefix`                              | `'/auth'`                                         | Server-managed: `refresh()` / `withAuthGuard` navigate to `${authUrlPrefix}/refresh`. Change it only to match a non-default BFF prefix |
| `discoveryDocumentCacheTTL` / `jwksCacheTTL` | `3600` / `600`                                    | Seconds                                                                                                                                |
| `logging`                                    | none                                              | `createDefaultLogging()` for console logs                                                                                              |

### `login()` / `register()` params (`ExtraRequestArgs`)

`prompt`, `display`, `loginHint`, `acrValues: string[]`, `uiLocales: string[]` and `audiences: string[]`. `register()` is `login()` with `prompt: 'create'`. Redirect mode adds `locationMethod: 'assign' | 'replace'` and `targetWindow: 'self' | 'top'`. Popup mode adds `popupWindowFeatures`, `popupWindowTarget` and `checkOrigin`.

## Patterns

### Call a protected API with the access token

```tsx
import { useStrivacity } from '@strivacity/sdk-preact';

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
import { useEffect } from 'preact/hooks';
import { useStrivacity } from '@strivacity/sdk-preact';

export function SessionWatcher() {
	const { loading, subscribeToEvent } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		const failed = subscribeToEvent('tokenRefreshFailed', () => {
			window.location.href = '/login';
		});

		return () => failed.dispose();
	}, [loading]);

	return null;
}
```

### Token refresh and logout

There is no background timer. With `autoRefresh: true` (default), `checkAuthentication()` refreshes once the access token is within `refreshSkew` seconds of expiry and a refresh token exists. With `serverSessionUri` set it never refreshes in the browser: `refresh()` (and `withAuthGuard` for an expired session) navigates to the BFF's refresh route (`` `${authUrlPrefix}/refresh` ``, default `/auth/refresh`), which rotates the cookie and redirects back. It runs when `withAuthGuard` mounts, after SDK events, and whenever you call it. If an expired access token is still in the session afterwards (no refresh token, or a transient refresh failure), it returns `false`. `refresh()` forces a refresh. `revoke()` revokes the tokens and clears the local session without visiting the IdP logout page. `await logout({ postLogoutRedirectUri: window.location.origin })` clears the local session and navigates to the IdP end-session endpoint. Without `postLogoutRedirectUri` the user stays on the Strivacity logout page.

Further reading: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-preact and https://docs.strivacity.com
