# Strivacity SolidStart Integration

Add Strivacity OIDC login to a Solid 2 app with `@strivacity/sdk-solid` v4. The target is Solid 2's "start" mode of `@solidjs/vite-plugin` (the SSR serving layer that replaces the classic `@solidjs/start` package). Sessions are server-managed (BFF, encrypted http-only cookies) by default. Client-managed mode is a one-line opt-out.

## Critical rules

- **Ask before creating or editing `.env*` files**, and never read an existing `.env` / `.env.local` into context without explicit permission. Tell the user which variables to add instead.
- **Solid 2 only.** Peer dependencies are `solid-js >=2` and `@solidjs/web >=2` (currently `2.0.0-rc.x`). Solid 1.x apps and classic SolidStart 1.x (`@solidjs/start`, `app.config.ts`, vinxi) are **not supported** by v4. Tell the user instead of forcing it in.
- **There is no root export.** Import from `@strivacity/sdk-solid/client` (provider, hooks, `withAuthGuard`, client types) and `@strivacity/sdk-solid/server` (server SDK, storages, server types). The package `exports` map has no `.` entry, so `import ... from '@strivacity/sdk-solid'` fails to resolve in Vite (the legacy `main` / `types` fields point at the client build only for tools that ignore `exports`). Do not add `@strivacity/sdk-core` directly.
- **The cookie `secret` is server-only.** Give it no `VITE_` prefix, read it only in server modules (`src/server/*`, `src/middleware.ts`, `'use server'` functions), and never import those modules from components. Generate it with `openssl rand -base64 32` (32+ random characters). Changing it invalidates all sessions.
- **No client secret anywhere.** Strivacity clients used by this SDK are public PKCE clients. Only the cookie-encryption `secret` exists.
- **v4 is a prerelease on the npm `next` dist-tag** (versions like `4.0.0-beta.x`). A plain `npm install @strivacity/sdk-solid` installs v3. Install with `@next` or an explicit 4.x version and pin it exactly.
- **Context values are accessors.** `useStrivacity()` returns `loading()`, `isAuthenticated()`, `idTokenClaims()` and so on. Call them inside JSX or reactive scopes. Do not destructure them into plain values.
- **Pick the mode first.** The quick start uses `mode: 'redirect'`. Mode-specific UI is covered by a separate mode reference loaded next to this one. Only the `mode` value and the login UI change between modes.

## Prerequisites

- `solid-js` and `@solidjs/web` `>=2` (2.0.0-rc), `@solidjs/vite-plugin` 3.x (`next`) with `start` + `ssr: true` + `serverFunctions: true`, and `@solidjs/router` 2.x (`next`). Vite 8+ (the plugin's peer range).
- A Strivacity application in the Admin Console:
  - `redirect` / `popup` mode: client type **"OIDC using no-code components"**.
  - `embedded` / `native` mode: client type **"OIDC using the Journey Flow API"**.
- Registered on that client: the redirect URI (for example `http://localhost:3000/callback`) and the post-logout redirect URI (defaults to your app origin, for example `http://localhost:3000`).
- Optional: Back-channel logout URI `https://<your-app>/auth/backchannel-logout` (needs a session-id storage, see Patterns).

## When NOT to use

- Solid 1.x, or SolidStart 1.x on `@solidjs/start`: not supported by v4. Point the user to https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-solid and ask before upgrading their framework.
- React, Preact, Next.js, Vue, Nuxt, SvelteKit, Angular: use the matching framework integration.
- A standalone Express BFF in front of a SPA: use the server-session reference with the `@strivacity/sdk-core` server SDK.

## Quick start

### 1. Install

```bash
npm install --save-exact @strivacity/sdk-solid@next
# or pin the exact version you tested, e.g.
npm install --save-exact @strivacity/sdk-solid@4.0.0-beta.1
# framework (Solid 2 prereleases)
npm install solid-js@next @solidjs/web@next @solidjs/router@next
npm install -D vite @solidjs/vite-plugin@next
```

### 2. Environment variables

Shared options are read on both sides, so they use the `VITE_` prefix. They are public identifiers. The secret has **no** prefix. Ask the user before writing:

```bash
# .env.local
VITE_STRIVACITY_ISSUER="https://<your-cluster-domain>"
VITE_STRIVACITY_CLIENT_ID="<your-client-id>"
VITE_STRIVACITY_REDIRECT_URI="http://localhost:3000/callback"
VITE_STRIVACITY_SCOPES="openid profile email"
STRIVACITY_SECRET="<output of: openssl rand -base64 32>"
```

In production, set `STRIVACITY_SECRET` in the server process environment.

### 3. Vite config

`start.middleware` mounts the auth routes. `ssr` and `serverFunctions` are required for server-managed sessions. Vite does not copy unprefixed `.env` values into `process.env`, so the config does it for the dev server:

```ts
// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import solid from '@solidjs/vite-plugin';

export default defineConfig(({ mode }) => {
	// Make STRIVACITY_SECRET from .env* visible to server code as process.env (real env vars win)
	Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env });

	return {
		plugins: [solid({ start: { middleware: './src/middleware.ts' }, ssr: true, serverFunctions: true })],
		server: { port: 3000 },
	};
});
```

### 4. Shared options

`serverSessionUri` must be set explicitly: the client SDK defaults it to `null` (client-managed), while the server SDK defaults to `'/auth/login'`. The browser SDK never refreshes in this mode: `withAuthGuard` and `refresh()` send an expired session through the server's refresh route at `` `${authUrlPrefix}/refresh` `` (client option, default `'/auth'`; set it only if the server SDK uses a different prefix).

```ts
// src/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-solid/client';

export const sdkOptions: SDKInitConfig = {
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native' - chosen separately
	issuer: import.meta.env.VITE_STRIVACITY_ISSUER,
	clientId: import.meta.env.VITE_STRIVACITY_CLIENT_ID,
	redirectUri: import.meta.env.VITE_STRIVACITY_REDIRECT_URI,
	scopes: (import.meta.env.VITE_STRIVACITY_SCOPES ?? 'openid').split(' '),
	serverSessionUri: '/auth/login', // set to false for client-managed sessions
};
```

### 5. Server SDK, middleware and session server function

`createServerSDK` throws `ConfigurationError: Missing SDK option: secret` if neither `secret` nor a custom `storage` is given, so create it lazily (a build pass without env vars must not crash).

```ts
// src/server/strivacity.ts
import type { SolidServerSDK } from '@strivacity/sdk-solid/server';
import { createServerSDK } from '@strivacity/sdk-solid/server';
import { sdkOptions } from '../options';

let sdk: SolidServerSDK | undefined;

export function getServerSdk(): SolidServerSDK {
	sdk ??= createServerSDK({
		...sdkOptions,
		secret: process.env.STRIVACITY_SECRET,
		postLoginRedirectUri: '/profile', // default: origin of redirectUri
		// postLogoutRedirectUri: '/',    // default: origin of redirectUri
		// authUrlPrefix: '/auth',        // default
		// loginUri: '/login',            // default
	});

	return sdk;
}
```

`sdk.middleware` serves `GET /auth/{login,register,callback,refresh,revoke,entry,logout}` and `POST /auth/backchannel-logout`, and calls `next(request)` for everything else:

```ts
// src/middleware.ts
import type { FetchMiddleware } from '@solidjs/web';
import { getServerSdk } from './server/strivacity';

const auth: FetchMiddleware = (request, next) => getServerSdk().middleware(request, next);

export default auth;
```

A `'use server'` function carries the session into SSR and hydration. Every server SDK method falls back to the ambient `getRequestEvent()`, so no event argument is needed:

```ts
// src/server/session.ts
import type { SessionData } from '@strivacity/sdk-solid/client';
import { toClientSession } from '@strivacity/sdk-solid/server';
import { getServerSdk } from './strivacity';

export async function getSession(): Promise<SessionData | null> {
	'use server';

	const session = await getServerSdk().getSession();

	// The session is serialized into the page. Keep the refresh token (the server refreshes from the cookie)
	// and the ID token (only the server-side /auth/logout route needs it) in the cookie.
	return toClientSession(session);
}
```

`getSession()` returns the full session: always pass it through `toClientSession()` (exported by `./server` and `./client`), which returns a copy without `refresh_token` and `id_token`. `ctx.idTokenClaims()` keeps working because the verified `claims` stay in the session.

`getSession()` refreshes a near-expiry session (refresh token present, within `refreshSkew`) at most once per request and hands the same rotated session to every caller in that request: middleware, server functions and rendering share one request event. `sdk.middleware` refreshes before the page renders (pages stream, so the response headers are gone by the time a session read inside `<Loading>` finishes) and writes the rotated cookie onto the response. If the refresh fails, `getSession()` returns `null`. `getSession(event, { autoRefresh: false })` (or the `autoRefresh: false` server option) reads the session as stored.

### 6. App root with provider and router

```tsx
// src/App.tsx
import { createMemo, Loading } from 'solid-js';
import { createRouter } from '@solidjs/router';
import { StyAuthProvider } from '@strivacity/sdk-solid/client';
import { sdkOptions } from './options';
import { getSession } from './server/session';
import Header from './components/Header';
import Login from './routes/login';
import Callback from './routes/callback';
import ErrorPage from './routes/error';
import Profile from './routes/profile';

const Home = () => <h1>Home</h1>;

const Router = createRouter({
	routes: [
		{ path: '/', component: Home },
		{ path: '/login', component: Login },
		{ path: '/callback', component: Callback },
		{ path: '/error', component: ErrorPage },
		{ path: '/profile', component: Profile },
	],
});

export default function App() {
	const session = createMemo(() => getSession());

	return (
		<Loading fallback={<main>Loading...</main>}>
			<StyAuthProvider options={sdkOptions} session={session()}>
				<Router>
					{(props) => (
						<>
							<Header />
							<Loading fallback={<main>Loading...</main>}>{props.children}</Loading>
						</>
					)}
				</Router>
			</StyAuthProvider>
		</Loading>
	);
}
```

### 7. Login / register / logout UI

In server-managed mode these are plain links to the auth routes. Add `rel="external"` so `@solidjs/router` does a full navigation instead of client-side routing. Do not call `ctx.logout()` here: it only clears the browser state and never clears the server cookie. `/auth/logout?returnTo=/some/path` comes back to a same-origin path (registered as a post-logout redirect URI) instead of `postLogoutRedirectUri`.

```tsx
// src/components/Header.tsx
import { Show } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function Header() {
	const ctx = useStrivacity();

	return (
		<header>
			<Show when={!ctx.loading()}>
				{ctx.isAuthenticated() ? (
					<>
						<span>Hello, {ctx.idTokenClaims()?.given_name ?? ctx.idTokenClaims()?.sub}</span>
						<a href="/auth/logout" rel="external">
							Log out
						</a>
					</>
				) : (
					<>
						<a href="/auth/login?returnTo=/profile" rel="external">
							Log in
						</a>
						<a href="/auth/register" rel="external">
							Sign up
						</a>
					</>
				)}
			</Show>
		</header>
	);
}
```

`withAuthGuard` sends anonymous users to `/login`. `login()` from the client SDK navigates to `serverSessionUri` (`/auth/login`) in server-managed mode and to the IdP in client-managed mode. Solid 2 effects take a compute function and an apply function:

```tsx
// src/routes/login.tsx
import { createEffect } from 'solid-js';
import type { RedirectFlow } from '@strivacity/sdk-solid/client';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function Login() {
	const ctx = useStrivacity<RedirectFlow>();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (!loading) {
				void ctx.login();
			}
		},
	);

	return <p>Redirecting to login...</p>;
}
```

### 8. Callback route

The IdP returns to `redirectUri` (`/callback`). Forward the query string to `/auth/callback`, which exchanges the code, sets the cookie and redirects to `returnTo` or `postLoginRedirectUri`. Alternatively register `http://localhost:3000/auth/callback` itself as `redirectUri`.

```tsx
// src/routes/callback.tsx
import { createEffect } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function Callback() {
	const ctx = useStrivacity();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			if (ctx.sdk.options.serverSessionUri) {
				globalThis.location.href = `/auth/callback${globalThis.location.search}`;
				return;
			}

			// Client-managed mode only
			ctx
				.handleCallback()
				.then(() => (globalThis.location.href = '/profile'))
				.catch((error: unknown) => (globalThis.location.href = `/error?error=${encodeURIComponent(error instanceof Error ? error.message : 'Login failed')}`));
		},
	);

	return <p>Logging in...</p>;
}
```

Auth-route failures redirect to `/error?type=...&error=...&error_description=...`:

```tsx
// src/routes/error.tsx
import { useSearchParams } from '@solidjs/router';

export default function ErrorPage() {
	const [searchParams] = useSearchParams();

	return (
		<section>
			<h1>Login failed</h1>
			<p>{(searchParams.error_description as string | undefined) ?? (searchParams.error as string | undefined) ?? 'Unknown error'}</p>
		</section>
	);
}
```

### 9. Protected route and claims

`withAuthGuard` waits for `loading()`, calls `checkAuthentication()` and sets `window.location.href = loginUri` (`'/login'`) when the user is not authenticated. It reads the session handed to the provider, so it also works on client-side navigations. That hydrated session ages while the tab stays open: when a hydrated session is no longer authenticated (expired) in server-managed mode, the guard calls `ctx.sdk.refresh()` instead, a full-page navigation to `` `${authUrlPrefix}/refresh?returnTo=<current URL>` `` that rotates the cookie and comes back.

```tsx
// src/routes/profile.tsx
import { withAuthGuard, useStrivacity } from '@strivacity/sdk-solid/client';

function Profile() {
	const ctx = useStrivacity();
	const expiresAt = () => ctx.accessTokenExpirationDate();

	return (
		<section>
			<h1>{ctx.idTokenClaims()?.email}</h1>
			<pre>{JSON.stringify(ctx.idTokenClaims(), null, 2)}</pre>
			<p>Access token expires at {expiresAt() ? new Date(expiresAt()! * 1000).toISOString() : 'n/a'}</p>
		</section>
	);
}

export default withAuthGuard(Profile, { loginUri: '/login', onLoading: () => <p>Loading...</p> });
```

Reactive accessors: `idTokenClaims()`, `accessToken()`, `refreshToken()`, `accessTokenExpired()`, `accessTokenExpirationDate()` (Unix seconds), `isAuthenticated()`, `language()`. Server-side, call `await getServerSdk().getSession()` inside a `'use server'` function or the middleware. It refreshes a near-expiry session (see step 5) and returns `null` when there is no usable session. A middleware guard is in Patterns.

### Client-managed mode (opt-in)

Set `serverSessionUri: false` in `src/options.ts`. Then remove `src/middleware.ts` (and `start.middleware`), `src/server/*`, the `session` prop and `STRIVACITY_SECRET`. Tokens live in `localStorage`. Use `ctx.login()` / `ctx.register()` / `ctx.logout({ postLogoutRedirectUri: globalThis.location.origin })` from click handlers instead of links, and keep the `/callback` route (its `handleCallback()` branch runs). `ssr: true` may stay, but the session is only known in the browser.

### Other modes in Solid (summary)

- `popup`: `ctx.login()` / `ctx.register()` from `useStrivacity<PopupFlow>()` resolve when the popup finishes. Call them from a click handler. In server-managed mode the popup's `/auth/callback` response closes the popup and notifies the opener. Then reload or navigate.
- `embedded`: render `<sty-login ref={(el) => (loginEl = el)}>` (JSX types ship with `./client`), call ``injectScript('sty-components', `${issuer}/assets/components/bundle.js`)`` in `onSettled`, set `params` / `sessionId` / `shortAppId` / `lang` as DOM properties on the element and listen for its `login` / `close` / `error` DOM events.
- `native`: `const ctx = useNativeLogin({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })` returns accessors (`ctx.loading()`, `ctx.state()`, `ctx.forms()`, `ctx.messages()`) plus `submitForm`, `setFormValue`, `setMessage`, `triggerFallback`, `triggerClose`. **Wrap your widget tree in `<STRIVACITY_LOGIN_CONTEXT value={ctx}>`** so widgets can call `useNativeLoginContext()`.
- Entry links (password reset and similar) for embedded/native: `/auth/entry` (server-managed) redirects to `loginUri` with `session_id`, `short_app_id` and `language`. Client-managed apps call `ctx.entry()` on an `/entry` route.

## Common mistakes

| Mistake                                                         | Fix                                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install @strivacity/sdk-solid` installs v3                 | Use `@strivacity/sdk-solid@next` or an exact `4.x` version, and pin it                                                                   |
| `import ... from '@strivacity/sdk-solid'` fails to resolve      | Use `@strivacity/sdk-solid/client` or `@strivacity/sdk-solid/server`                                                                     |
| Peer dependency errors, or `onSettled` / `Loading` not exported | The app is on Solid 1.x. v4 needs `solid-js` / `@solidjs/web` `>=2`                                                                      |
| `ctx.isAuthenticated` is always truthy                          | It is an accessor. Call `ctx.isAuthenticated()`                                                                                          |
| `ConfigurationError: Missing SDK option: secret`                | Set `STRIVACITY_SECRET` in the server env (dev: the `loadEnv` line in `vite.config.ts`) or pass a custom `storage`                       |
| 404 or app page on `/auth/login`                                | `start: { middleware: './src/middleware.ts' }` missing, or the link was client-routed. Add `rel="external"` to auth links                |
| `getSession()` returns `null` in the browser / errors on client | It must be a `'use server'` function, and `serverFunctions: true` must be set in the plugin options                                      |
| Client acts client-managed while the server SDK is set up       | `serverSessionUri` must be set in the shared options. Only the server SDK defaults to `'/auth/login'`                                    |
| `redirect_uri` mismatch                                         | `redirectUri` must exactly match the Admin Console entry. With the forwarding page that is `/callback`, not `/auth/callback`             |
| "State not found or expired" on `/auth/callback` in production  | Default login-state storage is in-process memory. On serverless or multi-instance hosting, pass a shared `stateStorage` (Redis/KV)       |
| `Cannot read properties of undefined` on `ctx.sdk`              | The SDK instance is created after the provider settles, client-side only. Gate SDK calls on `!ctx.loading()`                             |
| Hosted page errors, or embedded/native fails to start           | Client type must match mode: redirect/popup need "OIDC using no-code components"; embedded/native need "OIDC using the Journey Flow API" |

## API quick reference

### Server SDK (`createServerSDK(config)` from `@strivacity/sdk-solid/server`)

Extra options on top of the client options: `secret`, `storage` (default encrypted cookies, `cookieMaxAge` `2592000`), `stateStorage` (default in-memory), `authUrlPrefix` (`'/auth'`), `loginUri` (`'/login'`), `postLoginRedirectUri` and `postLogoutRedirectUri` (both default to the origin of `redirectUri`), and `serverSessionUri` (defaults to `` `${authUrlPrefix}/login` ``).

| Member                                                                                                                                       | Use                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `middleware(request, next)`                                                                                                                  | `FetchMiddleware` serving every auth route, `next(request)` otherwise                                                     |
| `getSession(event?, { autoRefresh? }?)`                                                                                                      | Session or `null`. Refreshes near expiry once per request event (unless `autoRefresh` is `false`); failed refresh: `null` |
| `refreshSession(event?)` / `revokeSession(event?)` / `updateSession(session, event?)`                                                        | Session management. Cookies are flushed by `sdk.middleware`                                                               |
| `handler(event?)`                                                                                                                            | Raw dispatcher: `Response` for auth routes, `null` otherwise                                                              |
| `handleLogin`, `handleRegister`, `handleCallback`, `handleRefresh`, `handleRevoke`, `handleEntry`, `handleLogout`, `handleBackChannelLogout` | Individual route handlers                                                                                                 |
| `completeLogin(params, event?)`, `logout(postLogoutRedirectUri, event?)`, `getEntrySession(entryUrl)`                                        | Building blocks for custom routes                                                                                         |

Auth route behaviour: `/auth/login` and `/auth/register` accept `returnTo` (same-origin only), `prompt`, `display`, `login_hint`, `acr_values`, `ui_locales`, `audience` (space-separated). `/auth/refresh` redirects to `returnTo` (otherwise `204`). `/auth/revoke` revokes and redirects to `postLogoutRedirectUri`. `/auth/logout` redirects to the IdP end-session endpoint, then to a same-origin `returnTo` (otherwise `postLogoutRedirectUri`). `/auth/entry` redirects to `loginUri` with entry params. `POST /auth/backchannel-logout` answers `200`, `400` or `501`.

Also exported: `createEncryptedCookieStorage`, `createSessionIdCookieStorage(storage, options?)`, `createServerMemoryStorage`, `isSessionExpired`, `toClientSession`, `createDefaultLogging`, errors, and types `SolidServerSDK`, `SolidServerSDKInitConfig`, `RequestEvent`.

### Client (`@strivacity/sdk-solid/client`)

- `<StyAuthProvider options session?>{children}</StyAuthProvider>`.
- `useStrivacity<Flow>()`: `sdk` (getter), accessors `loading`, `language`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired`, `accessTokenExpirationDate`, and methods `login`, `register`, `logout`, `handleCallback`, `refresh`, `revoke`, `checkAuthentication`, `init`, `tokenExchange`, `entry`, `subscribeToEvent`, `subscribeToAllEvents`.
- `withAuthGuard(Component, { loginUri = '/login', onLoading })`, `useNativeLogin(options)`, `useNativeLoginContext()`, `STRIVACITY_LOGIN_CONTEXT`, `injectScript`, client storages, `createDefaultLogging`.

### Key SDK options (shared) and defaults

`mode`, `issuer`, `clientId`, `redirectUri` (required; `mode` documented default `'redirect'`), `scopes` (`['openid']`), `responseType` / `responseMode` (`'code'` / `'query'`), client `storage` / `stateStorage` (`createLocalStorage()` / `createSessionStorage()`), `storageTokenName` (`'sty.session'`, also the server cookie name), `autoRefresh` / `refreshSkew` (`true` / `60` s), `lazyLoad` (`false`), `serverSessionUri` (client `null`; server `` `${authUrlPrefix}/login` ``), `authUrlPrefix` (`'/auth'`; with server-managed sessions the browser `refresh()` and `withAuthGuard` navigate to `` `${authUrlPrefix}/refresh` ``, so keep it equal to the server's prefix), `discoveryDocumentCacheTTL` / `jwksCacheTTL` (`3600` / `600` s), `logging` (none; `createDefaultLogging()` logs to the console).

`login()` / `register()` params (`ExtraRequestArgs`): `prompt`, `display`, `loginHint`, `acrValues`, `uiLocales` and `audiences`. In server-managed mode the client forwards them to `serverSessionUri` as query params.

## Patterns

### Server-side guard in the middleware

The middleware only sees full document requests (first load, `rel="external"` links, reloads), so keep `withAuthGuard` for client-side navigations. This guard redirects anonymous users to login. `getSession()` already refreshes a near-expiry session, the `getSession()` server function rendering the same request gets that rotated session, and `sdk.middleware` (listed first) writes the cookie:

```ts
// src/middleware.ts
import type { FetchMiddleware } from '@solidjs/web';
import { getServerSdk } from './server/strivacity';

const PROTECTED = ['/profile'];

const auth: FetchMiddleware = (request, next) => getServerSdk().middleware(request, next);

const guard: FetchMiddleware = async (request, next) => {
	const url = new URL(request.url);

	if (!PROTECTED.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
		return next(request);
	}

	// null when there is no session, or when refreshing a near-expiry session failed
	const session = await getServerSdk().getSession();

	if (!session) {
		const returnTo = encodeURIComponent(`${url.pathname}${url.search}`);

		return new Response(null, { status: 302, headers: { location: `/auth/login?returnTo=${returnTo}` } });
	}

	return next(request);
};

export default [auth, guard];
```

### Call a protected API and subscribe to events

- Server-side API calls: inside a `'use server'` function, read `(await getServerSdk().getSession())?.access_token` and send it as `Authorization: Bearer ...` from the server, so the token never reaches the browser. Request the API audience at login (`/auth/login?audience=https://api.example.com`, or `audiences` in `ctx.login()`).
- Client events (`init`, `sessionLoaded`, `loginInitiated`, `flowInitiated`, `loggedIn`, `sessionUpdated`, `tokenRefreshed`, `tokenRefreshFailed`, `accessTokenExpired`, `tokenRevoked`, `tokenRevokeFailed`, `logoutInitiated`, `sessionCleared`): subscribe inside `createEffect(() => ctx.loading(), (loading) => { if (loading) return; const sub = ctx.subscribeToEvent('sessionCleared', handler); return () => sub.dispose(); })`. The SDK instance does not exist before loading finishes.

### Token refresh and logout

- Server-managed: `getSession()` refreshes a near-expiry session automatically, once per request, and every caller in that request (middleware, server functions, rendering) gets the rotated session. `sdk.middleware` writes the cookie. `/auth/refresh?returnTo=/current/path` or `refreshSession()` refresh on demand. A refresh token is only issued if your client/scopes allow it (often `offline_access`). Logout: link to `/auth/logout` (IdP end-session, then `postLogoutRedirectUri`, or a same-origin `?returnTo=` registered as a post-logout redirect URI) or `/auth/revoke` (no IdP page). Client `ctx.logout()` does not clear the server cookie, so do not use it in this mode.
- The browser SDK never refreshes in server-managed mode: `checkAuthentication()` ignores `autoRefresh` when `serverSessionUri` is set. `withAuthGuard` and `ctx.sdk.refresh({ returnTo })` navigate to the refresh route instead (`ctx.refresh({ returnTo })` works the same; `returnTo` defaults to the current URL).
- Client-managed: `autoRefresh` (default `true`) refreshes during `checkAuthentication()` within `refreshSkew` of expiry; `ctx.refresh()` forces it. Logout: `await ctx.logout({ postLogoutRedirectUri: globalThis.location.origin })`.

### Back-channel logout

The default encrypted-cookie storage cannot delete sessions by `sid` (the route returns 501). Use `storage: createSessionIdCookieStorage(yourServerStorage)` from `@strivacity/sdk-solid/server`, where the storage implements `deleteByLogoutToken`. `createServerMemoryStorage()` works for local testing only.

### Production server

`vite build` writes `dist/client` and `dist/server/server.js`. The server bundle exports `handleRequest(request: Request): Promise<Response>` (and a default `{ fetch }` for Workers, Bun, Deno, Nitro). On Node, serve `dist/client` statically and pass everything else to `handleRequest`. When copying the response to Node's `res`, set cookies with `res.setHeader('set-cookie', response.headers.getSetCookie())`, because `headers.forEach` merges multiple `Set-Cookie` values and breaks the session cookies.

Further reading: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-solid and https://docs.strivacity.com
