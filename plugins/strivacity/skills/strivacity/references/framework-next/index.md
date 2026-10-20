# Strivacity Next.js Integration

Add Strivacity OIDC login to a Next.js app with `@strivacity/sdk-next` v4. Sessions are server-managed (BFF, encrypted http-only cookies) by default. App Router first, Pages Router briefly at the end.

## Critical rules

- **Ask before creating or editing `.env*` files that hold real values**, and never read an existing `.env` / `.env.local` into context without explicit permission. Tell the user which variables to add instead. A template with placeholders only (`.env.local.example`) is fine to create, but `create-next-app`'s `.gitignore` ignores `.env*`, so also add `!.env.local.example` there.
- **The `cookieSecret` is server-only.** Never prefix it with `NEXT_PUBLIC_`, never import the server SDK module into a `'use client'` file, and never pass the secret as a prop. Generate it with `openssl rand -base64 32` (32+ random characters). Changing it invalidates all existing sessions.
- **No client secret anywhere.** Strivacity clients used by this SDK are public PKCE clients. Only the `cookieSecret` exists.
- **v4 is a prerelease on the npm `next` dist-tag** (versions like `4.0.0-beta.x`). A plain `npm install @strivacity/sdk-next` installs v3, which has a different API. Install with `@next` or an explicit 4.x version and pin it exactly.
- **Import from the subpaths only:** `@strivacity/sdk-next/client` (hooks, provider, client types) and `@strivacity/sdk-next/server` (server SDK, storages, server types). The package `exports` map has no `.` entry, so a root `@strivacity/sdk-next` import fails to resolve (the legacy `main` / `types` fields point at the client build only for tools that ignore `exports`). Do not add `@strivacity/sdk-core` or `@strivacity/sdk-react` directly.
- **Pick the mode first.** The quick start uses `mode: 'redirect'`. Mode-specific UI is covered by a separate mode reference loaded next to this one. Only the `mode` value and the login UI change between modes.

## Prerequisites

- Next.js `>=15` (the `next` peer dependency) with React 18+. App Router recommended. The quick start also works with Cache Components (`cacheComponents: true` in `next.config.ts`, on by default in `create-next-app` 16).
- A Strivacity application in the Admin Console:
  - `redirect` / `popup` mode: client type **"OIDC using no-code components"**.
  - `embedded` / `native` mode: client type **"OIDC using the Journey Flow API"**.
- Registered on that client: the redirect URI (for example `http://localhost:3000/callback`) and the post-logout redirect URI (defaults to your app origin, for example `http://localhost:3000`).
- Optional: Back-channel logout URI `https://<your-app>/auth/backchannel-logout` (needs a session-id storage, see Patterns).

## When NOT to use

- Plain React SPA (Vite/CRA, no Next.js): use the React integration (`@strivacity/sdk-react`).
- Nuxt, SvelteKit, SolidStart, Angular SSR, Vue, Preact: use the matching framework integration.
- An Express or other standalone BFF behind a SPA: use the server-session reference with `@strivacity/sdk-core` server SDK.

## Quick start

### 1. Install

```bash
npm install @strivacity/sdk-next@next server-only
# or pin the exact version you tested, e.g.
npm install --save-exact @strivacity/sdk-next@4.0.0-beta.1 server-only
```

`server-only` is not part of the `create-next-app` template. It makes the build fail if the server SDK module is ever imported from a client component.

### 2. Environment variables

The shared options file is imported by a client component, so its values need the `NEXT_PUBLIC_` prefix. They are public identifiers. The secret has **no** prefix. Ask the user before writing:

```bash
# .env.local
NEXT_PUBLIC_STRIVACITY_ISSUER="https://<your-cluster-domain>"
NEXT_PUBLIC_STRIVACITY_CLIENT_ID="<your-client-id>"
NEXT_PUBLIC_STRIVACITY_REDIRECT_URI="http://localhost:3000/callback"
NEXT_PUBLIC_STRIVACITY_SCOPES="openid profile email"
STRIVACITY_COOKIE_SECRET="<output of: openssl rand -base64 32>"
```

`next build` needs these too, not just `next start`: it loads `lib/auth/server.ts` while collecting page data, and `createServerSDK` throws without the secret. Set them in CI and in the hosting provider's build environment. The `NEXT_PUBLIC_*` values are inlined at build time.

### 3. Shared options

`serverSessionUri` must be set explicitly here: the client SDK defaults it to `null` (client-managed), while the server SDK defaults to `'/auth/login'`. The browser SDK never refreshes in server-managed mode: the client `withAuthGuard` and `refresh()` send an expired session through `` `${authUrlPrefix}/refresh` `` (client option, default `'/auth'`; set it only if the server SDK uses a different prefix).

```ts
// lib/auth/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-next/client';

export const sdkOptions: SDKInitConfig = {
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native' - chosen separately
	issuer: process.env.NEXT_PUBLIC_STRIVACITY_ISSUER as string,
	clientId: process.env.NEXT_PUBLIC_STRIVACITY_CLIENT_ID as string,
	redirectUri: process.env.NEXT_PUBLIC_STRIVACITY_REDIRECT_URI as string,
	scopes: (process.env.NEXT_PUBLIC_STRIVACITY_SCOPES ?? 'openid').split(' '),
	serverSessionUri: '/auth/login', // set to false for client-managed sessions
};
```

### 4. Server SDK instance (server-only module)

`createServerSDK` throws `ConfigurationError` when the module loads (including during `next build`) if neither `cookieSecret` nor a custom `storage` is given.

```ts
// lib/auth/server.ts
import 'server-only';
import { createServerSDK } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';

export const sdk = createServerSDK({
	...sdkOptions,
	cookieSecret: process.env.STRIVACITY_COOKIE_SECRET,
	postLoginRedirectUri: '/profile', // default: origin of redirectUri
	// postLogoutRedirectUri: '/',    // default: origin of redirectUri
	// authUrlPrefix: '/auth',        // default
	// loginPageUri: '/login',            // default: where sdk.withAuthGuard sends anonymous users
});
```

### 5. Auth route handler

One catch-all handler serves `GET /auth/{login,register,callback,refresh,revoke,entry,logout}` and `POST /auth/backchannel-logout`. Unknown paths return 404. The folder must match `authUrlPrefix`.

```ts
// app/auth/[...strivacity]/route.ts
import { sdk } from '../../../lib/auth/server';

export const GET = sdk.handler;
export const POST = sdk.handler;
```

No `middleware.ts` / `proxy.ts` is required. The example app's `proxy.ts` only adds CORS headers on `/auth/:path*`.

### 6. Client provider and root layout

Keep the provider in its own `'use client'` file. Options that contain functions (`logging`, custom `storage`) cannot cross the server/client boundary as props.

```tsx
// lib/auth/provider.tsx
'use client';

import type { ReactNode } from 'react';
import type { SessionData } from '@strivacity/sdk-next/client';
import { StyAuthProvider } from '@strivacity/sdk-next/client';
import { sdkOptions } from './options';

export function AuthProvider({ session, children }: { session?: SessionData | null; children: ReactNode }) {
	return (
		<StyAuthProvider options={sdkOptions} session={session}>
			{children}
		</StyAuthProvider>
	);
}
```

```tsx
// app/layout.tsx
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { toClientSession } from '@strivacity/sdk-next/server';
import { AuthProvider } from '../lib/auth/provider';
import { sdk } from '../lib/auth/server';

// The session comes from the request cookies, so it is read in its own component behind <Suspense>
async function SessionProvider({ children }: { children: ReactNode }) {
	const session = await sdk.getSession();
	// The session is serialized into the page payload. Keep the refresh token (the /auth/refresh route uses it)
	// and the ID token (only the server-side /auth/logout route needs it) on the server.
	const clientSession = toClientSession(session);

	return <AuthProvider session={clientSession}>{children}</AuthProvider>;
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<Suspense fallback={<p>Loading...</p>}>
					<SessionProvider>{children}</SessionProvider>
				</Suspense>
			</body>
		</html>
	);
}
```

Reading cookies already makes the route dynamic, so no `export const dynamic = 'force-dynamic'` is needed. With Cache Components it is a build error ("Route segment config "dynamic" is not compatible with `nextConfig.cacheComponents`"), and an `await sdk.getSession()` directly in the layout fails prerendering ("uncached or runtime data"). The `<Suspense>` boundary above works with and without Cache Components. It also covers pages below it that read the session or `searchParams`. Merge these pieces into the app's existing root layout (fonts, `metadata`, global CSS) instead of replacing it. Render components that read the session, such as the `AuthNav` below, inside `SessionProvider` so they are under the same boundary.

`getSession()` returns the full session, so always pass it through `toClientSession()` (exported by `./server` and `./client`), which returns a copy without `refresh_token` and `id_token`. Server components cannot write cookies, so `getSession()` without a request never refreshes: it returns the stored session as is (`sdk.withAuthGuard` sends an expired one through `/auth/refresh`). `idTokenClaims` keeps working on the client because the verified `claims` stay in the session. Stripping `refresh_token` loses nothing: the browser SDK never refreshes in server-managed mode (`checkAuthentication()` ignores `autoRefresh` when `serverSessionUri` is set).

### 7. Login / register / logout UI

In server-managed mode these are plain links to the auth routes. Use `<a>`, not `<Link>`: they are route handlers that redirect to the IdP. Do not use the client `logout()` for this: it only clears the browser state and never clears the server cookie. `eslint-config-next` reports these `<a>` tags (`@next/next/no-html-link-for-pages`), so disable that rule in the files that link to `/auth/*`.

```tsx
// app/components/AuthNav.tsx
/* eslint-disable @next/next/no-html-link-for-pages -- /auth/* are route handlers that need a full navigation */
import { sdk } from '../../lib/auth/server';

export async function AuthNav() {
	const session = await sdk.getSession();

	return session ? (
		<nav>
			<span>Hello, {session.claims?.given_name ?? session.claims?.sub}</span>
			<a href="/auth/logout">Log out</a>
		</nav>
	) : (
		<nav>
			<a href="/auth/login?returnTo=/profile">Log in</a>
			<a href="/auth/register">Sign up</a>
		</nav>
	);
}
```

`sdk.withAuthGuard` redirects to `loginPageUri` (`/login`) with `?returnTo=`. Forward it, query string included, with a route handler. A route handler always answers with a real `307`, while a page that calls `redirect()` under the layout's `<Suspense>` only redirects on the client after streaming. In server-managed mode this replaces the client `login()` component shown for Next.js in the redirect mode reference.

```ts
// app/login/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function GET(req: NextRequest) {
	const url = req.nextUrl.clone();
	url.pathname = '/auth/login'; // keeps ?returnTo=

	return NextResponse.redirect(url);
}
```

### 8. Callback page

The IdP returns to `redirectUri` (`/callback`). Forward the query string to the auth route, which exchanges the code, sets the cookie and redirects to the `returnTo` value or `postLoginRedirectUri`. Alternatively, register `http://localhost:3000/auth/callback` itself as the `redirectUri` and skip this file.

```ts
// app/callback/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function GET(req: NextRequest) {
	const url = req.nextUrl.clone();
	url.pathname = '/auth/callback'; // keeps ?code=&state= (or ?error=)

	return NextResponse.redirect(url);
}
```

Auth-route failures redirect to `/error?type=...&error=...&error_description=...`, so create that page:

```tsx
// app/error/page.tsx
export default async function ErrorPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
	const { error, error_description } = await searchParams;

	return (
		<section>
			<h1>Login failed</h1>
			<p>{error_description ?? error ?? 'Unknown error'}</p>
			{/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler, needs a full navigation */}
			<a href="/auth/login">Try again</a>
		</section>
	);
}
```

### 9. Protected server page

`sdk.withAuthGuard(fn, { returnTo })` redirects anonymous users to `${loginPageUri}?returnTo=...` and injects `session`. It also checks expiry (with `refreshSkew`): an expired session with a refresh token is sent to `/auth/refresh?returnTo=...` (`returnTo`, otherwise `postLoginRedirectUri`), which writes the rotated cookie and comes back. Server components cannot set cookies, so the guard cannot refresh in place. An expired session without a refresh token counts as no session.

```tsx
// app/profile/page.tsx
import { sdk } from '../../lib/auth/server';

export default sdk.withAuthGuard(
	async function ProfilePage({ session }) {
		return (
			<section>
				<h1>{session?.claims?.email}</h1>
				<pre>{JSON.stringify(session?.claims, null, 2)}</pre>
			</section>
		);
	},
	{ returnTo: '/profile' },
);
```

### 10. Claims and tokens in client components

```tsx
// app/components/UserBadge.tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next/client';

export function UserBadge() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();

	if (loading || !isAuthenticated) {
		return null;
	}

	return <span>{idTokenClaims?.name ?? idTokenClaims?.sub}</span>;
}
```

The client `withAuthGuard` from `@strivacity/sdk-next/client` also works in `'use client'` pages. It uses the `session` passed to the provider and sets `window.location.href = '/login'` when unauthenticated. When that session has expired (it ages while the tab stays open), it calls `sdk.refresh()` instead: a full-page navigation to `` `${authUrlPrefix}/refresh?returnTo=<current URL>` ``, which rotates the cookie and comes back. Prefer the server `sdk.withAuthGuard` for server-managed pages.

### Client-managed mode (opt-in)

Set `serverSessionUri: false` in `lib/auth/options.ts`, then remove the server SDK, the `app/auth/[...strivacity]` route, the `session` prop and its `<Suspense>` wrapper, the `/login` and `/callback` route handlers and `STRIVACITY_COOKIE_SECRET`. Tokens then live in `localStorage` and everything happens in `'use client'` components with the same API as the React integration: call `login()` / `register()` / `logout()` from `useStrivacity()`, make `/callback` a client page that calls `handleCallback()` once `loading` is false, and guard pages with the client `withAuthGuard`.

### Other modes in Next.js (summary)

All of these live in `'use client'` components:

- `popup`: `login()` / `register()` from `useStrivacity<PopupFlow>()` resolve when the popup finishes. In server-managed mode the popup's `/auth/callback` response closes the popup and notifies the opener. Then reload or navigate.
- `embedded`: render `<sty-login>` after ``injectScript('sty-components', `${issuer}/assets/components/bundle.js`)`` and listen for its `login` / `close` / `error` DOM events.
- `native`: use `useNativeLogin({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })` and render `state.forms` / `state.layout` yourself. Widgets read the shared state with `useNativeLoginContext()`.
- Entry links (password reset and similar) for embedded/native: `/auth/entry` (server-managed) redirects to `loginPageUri` with `session_id`, `short_app_id` and `language`. Client-managed apps call `entry()` instead.

## Common mistakes

| Mistake                                                                                                          | Fix                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install @strivacity/sdk-next` installs v3                                                                   | Use `@strivacity/sdk-next@next` or an exact `4.x` version, and pin it                                                                                                                                                                                                                                                                   |
| `import ... from '@strivacity/sdk-next'` fails to resolve                                                        | Use `@strivacity/sdk-next/client` or `@strivacity/sdk-next/server`                                                                                                                                                                                                                                                                      |
| Options are `undefined` in the browser                                                                           | Client-visible env vars need `NEXT_PUBLIC_`. Rebuild after changing them (inlined at build time)                                                                                                                                                                                                                                        |
| `ConfigurationError: Missing SDK option: cookieSecret`                                                           | Set `STRIVACITY_COOKIE_SECRET` (server env) or pass a custom `storage`. `next build` needs it too, so set it in CI and in the build environment                                                                                                                                                                                         |
| `next/headers` / `fs` errors, or the secret in the client bundle                                                 | Server SDK (`lib/auth/server.ts`, `@strivacity/sdk-next/server`) imported from a `'use client'` file. Import it only in server components, route handlers or `getServerSideProps`. Keep `import 'server-only'` (install `server-only`) at the top of it                                                                                 |
| Client acts client-managed while the server SDK is set up                                                        | `serverSessionUri` must be set in the shared options. Only the server SDK defaults to `'/auth/login'`                                                                                                                                                                                                                                   |
| `redirect_uri` mismatch                                                                                          | `redirectUri` must exactly match the Admin Console entry. With the forwarding page that is `/callback`, not `/auth/callback`                                                                                                                                                                                                            |
| 404 on `/auth/login`                                                                                             | Route must be `app/auth/[...strivacity]/route.ts` (matching `authUrlPrefix`) and export `GET` (and `POST` for back-channel logout)                                                                                                                                                                                                      |
| Redirect loop or blank page after errors                                                                         | Create `app/error/page.tsx`. Auth routes redirect there on failure                                                                                                                                                                                                                                                                      |
| "State not found or expired" on `/auth/callback` in production                                                   | Default login-state storage is in-process memory. On serverless or multi-instance hosting, pass a shared `stateStorage` (Redis/KV) to `createServerSDK`                                                                                                                                                                                 |
| Guarded page renders with an expired token                                                                       | `withAuthGuard` already sends expired sessions to `/auth/refresh` (or to login without a refresh token). In server components `sdk.getSession()` returns the stored session without refreshing: check `isSessionExpired(session)` and redirect to `/auth/refresh?returnTo=...`. In route handlers `sdk.getSession(req)` refreshes first |
| Hosted page errors, or embedded/native fails to start                                                            | Client type must match mode: redirect/popup need "OIDC using no-code components"; embedded/native need "OIDC using the Journey Flow API"                                                                                                                                                                                                |
| `"dynamic" is not compatible with nextConfig.cacheComponents`, or "uncached or runtime data" during prerendering | Remove `export const dynamic`. Read the session in a component wrapped in `<Suspense>` (see the root layout). Reading cookies already makes the route dynamic                                                                                                                                                                           |
| Logout ends on a Strivacity error page                                                                           | Register `postLogoutRedirectUri` (default: app origin) on the client                                                                                                                                                                                                                                                                    |
| Using `<Link href="/auth/login">`                                                                                | Use `<a>`. Auth routes are route handlers that must do a full navigation. Disable `@next/next/no-html-link-for-pages` for those links                                                                                                                                                                                                   |

## API quick reference

### Server SDK (`createServerSDK(config)` from `@strivacity/sdk-next/server`)

Extra options on top of the client options: `cookieSecret`, `storage` (default encrypted cookies, `cookieMaxAge` `2592000`), `stateStorage` (default in-memory), `authUrlPrefix` (`'/auth'`), `loginPageUri` (`'/login'`), `postLoginRedirectUri` and `postLogoutRedirectUri` (both default to the origin of `redirectUri`), and `serverSessionUri` (defaults to `` `${authUrlPrefix}/login` ``).

| Member                                                                                                                                       | Use                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handler(req)`                                                                                                                               | Route handler dispatch for every auth route (404 otherwise)                                                                                                                                                                                                                                   |
| `getSession(req?, { autoRefresh? }?)`                                                                                                        | Session or `null`. With an App Router `Request` (route handlers) it refreshes a near-expiry session first, once per request (`null` when that fails). Without `req` (Server Components, uses `cookies()`) or with a Pages Router request it returns the stored session as is, no expiry check |
| `refreshSession(req?)` / `revokeSession(req?)` / `updateSession(session, req?)`                                                              | Session management in route handlers / server actions (they write cookies)                                                                                                                                                                                                                    |
| `withAuthGuard(fn, { returnTo? })`                                                                                                           | App Router page guard, injects `session`. Expired: redirects to refresh                                                                                                                                                                                                                       |
| `withAuthGuard({ getServerSideProps?, returnTo? })`                                                                                          | Pages Router `getServerSideProps` guard. Expired: redirects to refresh                                                                                                                                                                                                                        |
| `withApiAuthRequired(handler)`                                                                                                               | 401 `{ error: 'not_authenticated' }` for route handlers or Pages API routes                                                                                                                                                                                                                   |
| `handleLogin`, `handleRegister`, `handleCallback`, `handleRefresh`, `handleRevoke`, `handleEntry`, `handleLogout`, `handleBackChannelLogout` | Individual route handlers                                                                                                                                                                                                                                                                     |

Auth route query params: `/auth/login` and `/auth/register` accept `returnTo` (same-origin only), `prompt`, `display`, `login_hint`, `acr_values`, `ui_locales`, `audience` (space-separated). `/auth/refresh` accepts `returnTo` (otherwise `204`). `/auth/logout` accepts a same-origin `returnTo` (otherwise `postLogoutRedirectUri`).

### Client (`@strivacity/sdk-next/client`, same API as `@strivacity/sdk-react`)

- `<StyAuthProvider options session? children>`.
- `useStrivacity<Flow>()` returns `sdk`, `loading`, `language`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired`, `accessTokenExpirationDate`, `login`, `register`, `logout`, `handleCallback`, `refresh`, `revoke`, `checkAuthentication`, `init`, `tokenExchange`, `entry`, `subscribeToEvent`, `subscribeToAllEvents`.
- `withAuthGuard(Component, { loginPageUri = '/login', onLoading })`, `useNativeLogin(options)`, `useNativeLoginContext()`.

### Key SDK options (shared)

| Option                                       | Default                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `mode`, `issuer`, `clientId`, `redirectUri`  | required (`mode` documented default `'redirect'`)                                                      |
| `scopes`                                     | `['openid']`                                                                                           |
| `responseType` / `responseMode`              | `'code'` / `'query'`                                                                                   |
| `storage` / `stateStorage` (client)          | `createLocalStorage()` / `createSessionStorage()`                                                      |
| `storageTokenName`                           | `'sty.session'` (also the server cookie name)                                                          |
| `autoRefresh` / `refreshSkew`                | `true` / `60` seconds                                                                                  |
| `lazyLoad`                                   | `false`                                                                                                |
| `serverSessionUri`                           | client `null`; server `` `${authUrlPrefix}/login` ``                                                   |
| `authUrlPrefix`                              | `'/auth'` (server-managed `refresh()` / client `withAuthGuard` navigate to `${authUrlPrefix}/refresh`) |
| `discoveryDocumentCacheTTL` / `jwksCacheTTL` | `3600` / `600` seconds                                                                                 |
| `logging`                                    | none (`createDefaultLogging()`)                                                                        |

### `login()` / `register()` params (`ExtraRequestArgs`)

`prompt`, `display`, `loginHint`, `acrValues: string[]`, `uiLocales: string[]` and `audiences: string[]`. In server-managed mode the client forwards them to `serverSessionUri` as query params.

## Patterns

### Call a protected API (server-side, token never leaves the server)

```ts
// app/api/orders/route.ts
import { sdk } from '../../../lib/auth/server';

export const GET = sdk.withApiAuthRequired(async (req) => {
	// Route handlers can write cookies: getSession(req) refreshes a near-expiry session first (null when the refresh failed).
	// withApiAuthRequired already read it for this request, so this reuses that result
	const session = await sdk.getSession(req);

	if (!session?.access_token) {
		return Response.json({ error: 'not_authenticated' }, { status: 401 });
	}

	const upstream = await fetch('https://api.example.com/orders', {
		headers: { Authorization: `Bearer ${session.access_token}` },
	});

	return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' } });
});
```

Request the API audience at login (`/auth/login?audience=https://api.example.com`, or `audiences` in client `login()`).

### Token refresh

- Server-managed: `sdk.withAuthGuard` sends expired sessions to `/auth/refresh?returnTo=...` for you (expired without a refresh token: to login). `sdk.getSession()` without a request (Server Components) does not refresh or check expiry. In client components, `await sdk.refresh({ returnTo: '/current/path' })` on the flow instance (`useStrivacity().sdk`) navigates to `/auth/refresh?returnTo=...`; `useStrivacity().refresh({ returnTo })` works the same; `returnTo` defaults to the current URL. In route handlers, `await sdk.getSession(req)` refreshes only when needed (once per request, `null` when it fails); in route handlers and server actions `await sdk.refreshSession(req?)` always refreshes. Server components cannot set cookies. The browser SDK never refreshes in this mode (`autoRefresh` is ignored when `serverSessionUri` is set). A refresh token is only issued if your client/scopes allow it (often `offline_access`).
- Client-managed: `autoRefresh` (default `true`) refreshes during `checkAuthentication()` once the token is within `refreshSkew` (60 s) of expiry. Call `refresh()` to force it.

### Subscribe to events (client)

Events: `init`, `sessionLoaded`, `loginInitiated`, `flowInitiated`, `loggedIn`, `sessionUpdated`, `tokenRefreshed`, `tokenRefreshFailed`, `accessTokenExpired`, `tokenRevoked`, `tokenRevokeFailed`, `logoutInitiated`, `sessionCleared`.

```tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';

export function SessionEvents() {
	const { loading, subscribeToEvent } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return; // the SDK instance does not exist before loading finishes
		}

		const sub = subscribeToEvent('sessionCleared', () => window.location.assign('/'));

		return () => sub.dispose();
	}, [loading]);

	return null;
}
```

### Logout

- Server-managed: link to `/auth/logout`. It clears the cookie and redirects to the IdP end-session endpoint with `post_logout_redirect_uri` = a same-origin `?returnTo=`, otherwise `postLogoutRedirectUri`. Register every such URI as a post-logout redirect URI on the client. From a client component, navigate there (`window.location.href = '/auth/logout?returnTo=/'`). The client `logout()` does not clear the server cookie. `/auth/revoke` revokes tokens and redirects to `postLogoutRedirectUri` without the IdP logout page.
- Client-managed: `await logout({ postLogoutRedirectUri: window.location.origin })`.

### Back-channel logout

The default encrypted-cookie storage cannot delete sessions by `sid` (the route returns 501). Use `storage: createSessionIdCookieStorage(yourServerStorage)` from `@strivacity/sdk-next/server`, where the storage implements `deleteByLogoutToken`. `createServerMemoryStorage()` works for local testing only.

### Pages Router (brief)

- Keep the auth catch-all as an App Router route handler (`app/auth/[...strivacity]/route.ts`). `app/` and `pages/` can coexist. `sdk.handler` expects a Web `Request`, not a Node `IncomingMessage`.
- Wrap `pages/_app.tsx` in `<StyAuthProvider options={sdkOptions} session={pageProps.session ?? null}>`. Return the session from `getServerSideProps` as `toClientSession(session)`, as in the App Router layout. `sdk.withAuthGuard({ getServerSideProps })` adds the full session as `props.session` unless your `getServerSideProps` returns its own `session` prop, so return the stripped one there too.
- Read the session in `getServerSideProps` with `await sdk.getSession(ctx.req)` and return `{ redirect: { destination: '/login?returnTo=...', permanent: false } }` when it is `null`. With a Pages Router request `getSession` never refreshes or checks expiry, so also redirect to `/auth/refresh?returnTo=...` when `isSessionExpired(session)` and `session.refresh_token` is set. `sdk.withAuthGuard({ returnTo, getServerSideProps })` does both (`returnTo` defaults to `ctx.resolvedUrl`).
- API routes: `export default sdk.withApiAuthRequired(async (req, res) => { const session = await sdk.getSession(req); res.json({ sub: session?.claims?.sub }); });`

Further reading: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-next and https://docs.strivacity.com
