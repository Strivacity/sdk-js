# Strivacity SvelteKit Integration

Add Strivacity OIDC login to a Svelte 5 / SvelteKit 2 app with `@strivacity/sdk-svelte` v4. Sessions are server-managed (BFF, encrypted http-only cookies) by default, wired through `hooks.server.ts`. Client-managed mode is a one-line opt-out.

## Critical rules

- **Ask before creating or editing `.env*` files**, and never read an existing `.env` / `.env.local` into context without explicit permission. Tell the user which variables to add instead.
- **Svelte 5 (runes) only.** Peer dependencies are `svelte >=5` and `@sveltejs/kit >=2` (optional, needed for the server SDK). Svelte 3/4 stores-based apps are **not supported** by v4. Tell the user instead of forcing it in.
- **There is no root export.** Import from `@strivacity/sdk-svelte/client` (`createStyAuthProvider`, `useStrivacity`, `useNativeLogin`, client types) and `@strivacity/sdk-svelte/server` (`createServerSDK`, storages, server types). The package `exports` map has no `.` entry, so `import ... from '@strivacity/sdk-svelte'` fails to resolve in Vite / SvelteKit (the legacy `main` / `types` fields point at the client build only for tools that ignore `exports`). Do not add `@strivacity/sdk-core` directly.
- **`createStyAuthProvider` is a function, not a component.** Call it once, synchronously, at the top of the root `+layout.svelte` `<script>`. `useStrivacity()` / `useNativeLogin()` use Svelte context, so call them at the top of a component `<script>` too, never in `onMount`, event handlers or plain `.ts` modules. Your own helpers that use runes must live in `*.svelte.ts` files.
- **The `cookieSecret` is server-only.** Read it through `$env/dynamic/private` (or `$env/static/private`) inside `src/lib/server/` or `hooks.server.ts`. SvelteKit refuses to bundle those into client code. Never give it a `PUBLIC_` / `VITE_` prefix. Generate it with `openssl rand -base64 32` (32+ random characters). Changing it invalidates all sessions.
- **No client secret anywhere.** Strivacity clients used by this SDK are public PKCE clients. Only the `cookieSecret` exists.
- **v4 is a prerelease on the npm `next` dist-tag** (versions like `4.0.0-beta.x`). A plain `npm install @strivacity/sdk-svelte` installs v3. Install with `@next` or an explicit 4.x version and pin it exactly.
- **Pick the mode first.** The quick start uses `mode: 'redirect'`. Mode-specific UI is covered by a separate mode reference loaded next to this one. Only the `mode` value and the login UI change between modes.

## Prerequisites

- `svelte >=5` and `@sveltejs/kit >=2` (with `@sveltejs/vite-plugin-svelte` and an adapter that runs server code, for example `adapter-node` or `adapter-auto`). A static-only adapter (`adapter-static`) needs client-managed mode.
- A Strivacity application in the Admin Console:
  - `redirect` / `popup` mode: client type **"OIDC using no-code components"**.
  - `embedded` / `native` mode: client type **"OIDC using the Journey Flow API"**.
- Registered on that client: the redirect URI (for example `http://localhost:5173/callback`) and the post-logout redirect URI (defaults to your app origin, for example `http://localhost:5173`).
- Optional: Back-channel logout URI `https://<your-app>/auth/backchannel-logout` (needs a session-id storage, see Patterns).

## When NOT to use

- Svelte 3/4, or SvelteKit 1: not supported by v4. Point the user to https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-svelte and ask before upgrading their framework.
- React, Preact, Next.js, Vue, Nuxt, SolidStart, Angular: use the matching framework integration.
- A standalone Express BFF in front of a SPA: use the server-session reference with the `@strivacity/sdk-core` server SDK.

## Quick start

### 1. Install

```bash
npm install --save-exact @strivacity/sdk-svelte@next
# or pin the exact version you tested, e.g.
npm install --save-exact @strivacity/sdk-svelte@4.0.0-beta.1
```

### 2. Environment variables

Shared options are read on both sides, so they use SvelteKit's `PUBLIC_` prefix. They are public identifiers. The secret has **no** prefix. Ask the user before writing:

```bash
# .env
PUBLIC_STRIVACITY_ISSUER="https://<your-cluster-domain>"
PUBLIC_STRIVACITY_CLIENT_ID="<your-client-id>"
PUBLIC_STRIVACITY_REDIRECT_URI="http://localhost:5173/callback"
PUBLIC_STRIVACITY_SCOPES="openid profile email"
STRIVACITY_COOKIE_SECRET="<output of: openssl rand -base64 32>"
```

### 3. Shared options

`serverSessionUri` must be set explicitly: the client SDK defaults it to `null` (client-managed), while the server SDK defaults to `'/auth/login'`.

```ts
// src/lib/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-svelte/client';
import { PUBLIC_STRIVACITY_CLIENT_ID, PUBLIC_STRIVACITY_ISSUER, PUBLIC_STRIVACITY_REDIRECT_URI, PUBLIC_STRIVACITY_SCOPES } from '$env/static/public';

export const sdkOptions: SDKInitConfig = {
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native' - chosen separately
	issuer: PUBLIC_STRIVACITY_ISSUER,
	clientId: PUBLIC_STRIVACITY_CLIENT_ID,
	redirectUri: PUBLIC_STRIVACITY_REDIRECT_URI,
	scopes: (PUBLIC_STRIVACITY_SCOPES || 'openid').split(' '),
	serverSessionUri: '/auth/login', // set to false for client-managed sessions
};
```

### 4. Server SDK (server-only module)

`createServerSDK` throws `ConfigurationError: Missing SDK option: cookieSecret` if neither `cookieSecret` nor a custom `storage` is given, so create it lazily (a build or prerender pass without env vars must not crash).

```ts
// src/lib/server/strivacity.ts
import type { SvelteKitServerSDK } from '@strivacity/sdk-svelte/server';
import { createServerSDK } from '@strivacity/sdk-svelte/server';
import { env } from '$env/dynamic/private';
import { sdkOptions } from '$lib/options';

let sdk: SvelteKitServerSDK | undefined;

export function getServerSdk(): SvelteKitServerSDK {
	sdk ??= createServerSDK({
		...sdkOptions,
		cookieSecret: env.STRIVACITY_COOKIE_SECRET,
		postLoginRedirectUri: '/profile', // default: origin of redirectUri
		// postLogoutRedirectUri: '/',    // default: origin of redirectUri
		// authUriPrefix: '/auth',        // default
		// loginPageUri: '/login',            // default: requireSession target in embedded/native mode
	});

	return sdk;
}
```

### 5. `hooks.server.ts`

`sdk.handle` serves `GET /auth/{login,register,callback,refresh,revoke,entry,logout}` and `POST /auth/backchannel-logout`, and calls `resolve(event)` for everything else. Do not create `src/routes/auth/*` pages, they would be shadowed.

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { getServerSdk } from '$lib/server/strivacity';

export const handle: Handle = (input) => getServerSdk().handle(input);
```

To combine it with your own hooks: `export const handle = sequence((input) => getServerSdk().handle(input), yourHandle);` (`sequence` from `@sveltejs/kit/hooks`).

### 6. Root layout: load the session and create the provider

```ts
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { toClientSession } from '@strivacity/sdk-svelte/server';
import { getServerSdk } from '$lib/server/strivacity';

export const load: LayoutServerLoad = async (event) => {
	const session = await getServerSdk().getSession(event);

	// The session is serialized into the page. Keep the refresh token (the server refreshes from the cookie)
	// and the ID token (only the server-side /auth/logout route needs it) in the cookie.
	return { session: toClientSession(session) };
};
```

`getSession()` returns the full session: always pass it through `toClientSession()` (exported by `./server` and `./client`), which returns a copy without `refresh_token` and `id_token`. `ctx.idTokenClaims` keeps working because the verified `claims` stay in the session.

`getSession(event)` refreshes a near-expiry session (refresh token present, within `refreshSkew`) at most once per request and hands the same rotated session to every caller in that request (this layout `load`, the page `load` functions SvelteKit runs concurrently, your hooks). `+server.ts` endpoints behave the same. `sdk.handle` writes the rotated cookie onto the response. If the refresh fails, `getSession()` returns `null`. `getSession(event, { autoRefresh: false })` (or the `autoRefresh: false` server option) reads the session as stored.

Pass the session as a **getter** so the provider picks up new values after navigations and `invalidateAll()`:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import type { LayoutProps } from './$types';
	import { createStyAuthProvider } from '@strivacity/sdk-svelte/client';
	import { sdkOptions } from '$lib/options';
	import Header from '$lib/components/Header.svelte';

	let { data, children }: LayoutProps = $props();

	createStyAuthProvider({
		options: sdkOptions,
		session: () => data.session,
	});
</script>

<Header />
<main>
	{@render children()}
</main>
```

The SDK instance is only created in the browser. During SSR `ctx.loading` is `true` and `ctx.sdk` is `undefined`, so do not touch `ctx.sdk` in markup. Use `data.session` for server-rendered content.

### 7. Login / register / logout UI

In server-managed mode these are plain links to the auth routes. `data-sveltekit-reload` forces a full navigation to the hook. Do not call `ctx.logout()` here: it only clears the browser state and never clears the server cookie. `/auth/logout?returnTo=/some/path` comes back to a same-origin path (registered as a post-logout redirect URI) instead of `postLogoutRedirectUri`.

```svelte
<!-- src/lib/components/Header.svelte -->
<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();
	const name = $derived(ctx.idTokenClaims?.given_name ?? ctx.idTokenClaims?.sub);
</script>

<header>
	{#if !ctx.loading}
		{#if ctx.isAuthenticated}
			<span>Hello, {name}</span>
			<a href="/auth/logout" data-sveltekit-reload>Log out</a>
		{:else}
			<a href="/auth/login?returnTo=/profile" data-sveltekit-reload>Log in</a>
			<a href="/auth/register" data-sveltekit-reload>Sign up</a>
		{/if}
	{/if}
</header>
```

A `/login` page is needed in client-managed mode and as the `loginPageUri` target in embedded/native mode. In redirect mode `ctx.login()` navigates to `serverSessionUri` (`/auth/login`) when server-managed and to the IdP when client-managed:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { RedirectFlow } from '@strivacity/sdk-svelte/client';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<RedirectFlow>();

	onMount(() => {
		void ctx.login();
	});
</script>

<p>Redirecting to login...</p>
```

### 8. Callback page

The IdP returns to `redirectUri` (`/callback`). Forward the query string to `/auth/callback`, which exchanges the code, sets the cookie and redirects to `returnTo` or `postLoginRedirectUri`. Alternatively register `http://localhost:5173/auth/callback` itself as `redirectUri`.

```svelte
<!-- src/routes/callback/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (ctx.sdk.options.serverSessionUri) {
			globalThis.location.href = `/auth/callback${location.search}`;
			return;
		}

		// Client-managed mode only
		try {
			await ctx.handleCallback();
			await goto('/profile', { replaceState: true });
		} catch (error) {
			await goto(`/error?error=${encodeURIComponent(error instanceof Error ? error.message : 'Login failed')}`, { replaceState: true });
		}
	});
</script>

<p>Logging in...</p>
```

Auth-route failures redirect to `/error?type=...&error=...&error_description=...`:

```svelte
<!-- src/routes/error/+page.svelte -->
<script lang="ts">
	import { page } from '$app/state';
</script>

<section>
	<h1>Login failed</h1>
	<p>{page.url.searchParams.get('error_description') ?? page.url.searchParams.get('error') ?? 'Unknown error'}</p>
	<a href="/auth/login" data-sveltekit-reload>Try again</a>
</section>
```

### 9. Protected page

`requireSession(event, { returnTo })` returns the session or throws a SvelteKit `redirect()` to `/auth/login?returnTo=...` (redirect/popup) or `loginPageUri?returnTo=...` (embedded/native). Server `load` functions run on every navigation, including client-side ones. `requireSession()` reads through `getSession(event)`, so a near-expiry session is refreshed once for the whole request: the root layout `load` gets the same rotated session, and `sdk.handle` writes the new cookie. A failed refresh counts as no session and redirects to login.

```ts
// src/routes/profile/+page.server.ts
import type { PageServerLoad } from './$types';
import { getServerSdk } from '$lib/server/strivacity';

export const load: PageServerLoad = async (event) => {
	const session = await getServerSdk().requireSession(event, { returnTo: '/profile' });

	return { claims: session.claims ?? null };
};
```

```svelte
<!-- src/routes/profile/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	let { data }: PageProps = $props();

	const ctx = useStrivacity();
	const expiresAt = $derived(ctx.accessTokenExpirationDate ? new Date(ctx.accessTokenExpirationDate * 1000).toISOString() : 'n/a');
</script>

<section>
	<h1>{data.claims?.email}</h1>
	<pre>{JSON.stringify(data.claims, null, 2)}</pre>
	<p>Access token expires at {expiresAt}</p>
</section>
```

`useStrivacity()` exposes plain reactive getters: `ctx.loading`, `ctx.isAuthenticated`, `ctx.idTokenClaims`, `ctx.accessToken`, `ctx.refreshToken`, `ctx.accessTokenExpired`, `ctx.accessTokenExpirationDate` (Unix seconds), `ctx.language`. Read them as `ctx.x` in markup or `$derived`. Destructuring (`const { isAuthenticated } = useStrivacity()`) loses reactivity.

### Client-managed mode (opt-in)

Set `serverSessionUri: false` in `src/lib/options.ts`, then remove `hooks.server.ts`, `src/lib/server/strivacity.ts`, both `+*.server.ts` loads, the `session` getter and `STRIVACITY_COOKIE_SECRET`. Tokens live in `localStorage`, so server `load` cannot see them. Use `ctx.login()` / `ctx.register()` / `ctx.logout({ postLogoutRedirectUri: location.origin })` from click handlers, keep `/callback` (its `handleCallback()` branch runs) and guard pages in the component:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (!(await ctx.checkAuthentication())) {
			await goto('/login');
		}
	});
</script>

{#if ctx.isAuthenticated}
	<h1>{ctx.idTokenClaims?.email}</h1>
{/if}
```

### Other modes in SvelteKit (summary)

- `popup`: `await ctx.login()` / `ctx.register()` from `useStrivacity<PopupFlow>()` resolve when the popup finishes. Call them from a click handler. In server-managed mode the popup's `/auth/callback` response closes the popup and notifies the opener. Then `invalidateAll()` or reload.
- `embedded`: load the bundle with ``injectScript('sty-components', `${issuer}/assets/components/bundle.js`)`` in `onMount`, render `<sty-login {params} {sessionId} {shortAppId} lang={...} onlogin={...} onclose={...} onerror={...}>` (Svelte sets known custom-element props as DOM properties) plus optional `<sty-notifications>` / `<sty-language-selector>`.
- `native`: `const ctx = useNativeLogin({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })` at the top of the login component's `<script>`. It sets the login context automatically, so child widgets call `useNativeLoginContext()`. Render `ctx.state.forms` / `ctx.state.layout` yourself and call `ctx.submitForm(formId)`.
- Entry links (password reset and similar) for embedded/native: `/auth/entry` (server-managed) redirects to `loginPageUri` with `session_id`, `short_app_id` and `language`. Client-managed apps call `ctx.entry()` on an `/entry` page.

## Common mistakes

| Mistake                                                        | Fix                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install @strivacity/sdk-svelte` installs v3               | Use `@strivacity/sdk-svelte@next` or an exact `4.x` version, and pin it                                                                  |
| `import ... from '@strivacity/sdk-svelte'` fails to resolve    | Use `@strivacity/sdk-svelte/client` or `@strivacity/sdk-svelte/server`                                                                   |
| `Missing SDK context`                                          | `createStyAuthProvider` must run in the root `+layout.svelte`, and `useStrivacity()` at the top of a component `<script>`                |
| `lifecycle_outside_component` / `getContext` errors            | `useStrivacity()` / `useNativeLogin()` called in `onMount`, an event handler or a plain `.ts` module. Call it during component init      |
| UI never updates after login                                   | Context was destructured. Read `ctx.isAuthenticated`, not a copied value                                                                 |
| `ConfigurationError: Missing SDK option: cookieSecret`         | Set `STRIVACITY_COOKIE_SECRET` (server env) or pass a custom `storage`                                                                   |
| "Cannot import $env/dynamic/private into client-side code"     | The server SDK module was imported from a `.svelte` file or universal `+page.ts`. Keep it in `$lib/server/` and server loads/hooks       |
| 404 on `/auth/login`                                           | `hooks.server.ts` does not export `handle`, or it was not wired to `sdk.handle`                                                          |
| Client acts client-managed while the server SDK is set up      | `serverSessionUri` must be set in the shared options. Only the server SDK defaults to `'/auth/login'`                                    |
| Provider shows a stale session after navigation                | Pass `session: () => data.session` (a getter), not `session: data.session`                                                               |
| `redirect_uri` mismatch                                        | `redirectUri` must exactly match the Admin Console entry. With the forwarding page that is `/callback`, not `/auth/callback`             |
| "State not found or expired" on `/auth/callback` in production | Default login-state storage is in-process memory. On serverless or multi-instance hosting, pass a shared `stateStorage` (Redis/KV)       |
| Hosted page errors, or embedded/native fails to start          | Client type must match mode: redirect/popup need "OIDC using no-code components"; embedded/native need "OIDC using the Journey Flow API" |

## API quick reference

### Server SDK (`createServerSDK(config)` from `@strivacity/sdk-svelte/server`)

Extra options on top of the client options: `cookieSecret`, `clientSecret` and `tokenEndpointAuthMethod` (`'client_secret_basic'` with `clientSecret`, otherwise `'none'`; or `'client_secret_post'`: confidential client authentication at the token and revocation endpoints, PKCE stays on; server-only, the client SDK throws on `clientSecret`), `storage` (default encrypted cookies, `cookieMaxAge` `2592000`), `stateStorage` (default in-memory), `authUriPrefix` (`'/auth'`), `loginPageUri` (`'/login'`), `postLoginRedirectUri` and `postLogoutRedirectUri` (both default to the origin of `redirectUri`), and `serverSessionUri` (defaults to `` `${authUriPrefix}/login` ``).

| Member                                                                                                                                       | Use                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `handle`                                                                                                                                     | SvelteKit `Handle` serving every auth route, `resolve(event)` otherwise                                                    |
| `requireSession(event, { returnTo? })`                                                                                                       | Server `load` guard. Returns the session or throws `redirect()` to login. Refreshes near expiry (see step 9)               |
| `getSession(event, { autoRefresh? }?)`                                                                                                       | Session or `null`. Refreshes a near-expiry session once per request (`null` if that fails) unless `autoRefresh` is `false` |
| `refreshSession(event)` / `revokeSession(event)` / `updateSession(session, event)`                                                           | Session management. Cookies they queue are written by `sdk.handle`                                                         |
| `handler(event)`                                                                                                                             | Raw dispatcher: `Response` for auth routes, `null` otherwise                                                               |
| `handleLogin`, `handleRegister`, `handleCallback`, `handleRefresh`, `handleRevoke`, `handleEntry`, `handleLogout`, `handleBackChannelLogout` | Individual route handlers (usable from `+server.ts`)                                                                       |

Auth route behaviour: `/auth/login` and `/auth/register` accept `returnTo` (same-origin only), `prompt`, `display`, `login_hint`, `acr_values`, `ui_locales`, `audience` (space-separated). `/auth/refresh` redirects to `returnTo` (otherwise `204`). `/auth/revoke` revokes and redirects to `postLogoutRedirectUri`. `/auth/logout` redirects to the IdP end-session endpoint, then to a same-origin `returnTo` (otherwise `postLogoutRedirectUri`). `/auth/entry` redirects to `loginPageUri` with entry params. `POST /auth/backchannel-logout` answers `200`, `400` or `501`.

Also exported: `createEncryptedCookieStorage`, `createSessionIdCookieStorage(storage, options?)`, `createServerMemoryStorage`, `isSessionExpired`, `toClientSession`, `createDefaultLogging`, errors, and types `SvelteKitServerSDK`, `SvelteKitServerSDKInitConfig`, `SessionData`.

### Client (`@strivacity/sdk-svelte/client`)

- `createStyAuthProvider({ options, session?: () => SessionData | null | undefined })` returns the same context object `useStrivacity()` returns.
- `useStrivacity<Flow>()`: getters `sdk`, `loading`, `language`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired`, `accessTokenExpirationDate`, and methods `login`, `register`, `logout`, `handleCallback`, `refresh`, `revoke`, `checkAuthentication`, `init`, `tokenExchange`, `entry`, `subscribeToEvent`, `subscribeToAllEvents`.
- `useNativeLogin(options)`, `useNativeLoginContext()`, `injectScript`, client storages, `createDefaultLogging`. There is no client `withAuthGuard`: guard with `requireSession` (server) or `checkAuthentication()` (client-managed).

### Key SDK options (shared) and defaults

`mode`, `issuer`, `clientId`, `redirectUri` (required; `mode` documented default `'redirect'`), `scopes` (`['openid']`), `responseType` / `responseMode` (`'code'` / `'query'`), client `storage` / `stateStorage` (`createLocalStorage()` / `createSessionStorage()`), `storageKey` (`'sty.session'`, also the server cookie name), `autoRefresh` / `refreshSkew` (`true` / `60` s), `lazyLoad` (`false`), `serverSessionUri` (client `null`; server `` `${authUriPrefix}/login` ``), `authUriPrefix` (`'/auth'`; the browser `refresh()` navigates to `` `${authUriPrefix}/refresh` `` with server-managed sessions, so keep it equal to the server's prefix), `discoveryDocumentCacheTTL` / `jwksCacheTTL` (`3600` / `600` s), `logging` (none; `createDefaultLogging()` logs to the console).

`login()` / `register()` params (`ExtraRequestArgs`): `prompt`, `display`, `loginHint`, `acrValues`, `uiLocales` and `audiences`. In server-managed mode the client forwards them to `serverSessionUri` as query params.

## Patterns

### Call a protected API (server-side, token never leaves the server)

In a `+server.ts` endpoint or server `load`, read `(await getServerSdk().getSession(event))?.access_token`, call `error(401, 'not_authenticated')` when it is missing, and call the upstream API with ``event.fetch(url, { headers: { Authorization: `Bearer ${token}` } })``. Request the API audience at login (`/auth/login?audience=https://api.example.com`, or `audiences` in `ctx.login()`).

### Guard a whole section in `hooks.server.ts`

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getServerSdk } from '$lib/server/strivacity';

const auth: Handle = (input) => getServerSdk().handle(input);

const guard: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/account')) {
		// Refreshes a near-expiry session once. Loads in this request get the same rotated session, and `auth` writes the cookie
		await getServerSdk().requireSession(event); // returnTo defaults to the current path and query
	}

	return resolve(event);
};

export const handle = sequence(auth, guard);
```

### Subscribe to events (client)

Events: `init`, `sessionLoaded`, `loginInitiated`, `flowInitiated`, `loggedIn`, `sessionUpdated`, `tokenRefreshed`, `tokenRefreshFailed`, `accessTokenExpired`, `tokenRevoked`, `tokenRevokeFailed`, `logoutInitiated`, `sessionCleared`. Subscribe in `onMount` (the SDK exists only in the browser) and dispose on destroy: `onMount(() => { const sub = ctx.subscribeToEvent('sessionCleared', () => location.assign('/')); return () => sub.dispose(); });`.

### Token refresh and logout

- Server-managed: `getSession(event)` / `requireSession(event)` refresh a near-expiry session automatically, once per request, and every `load` and hook in that request gets the rotated session. `sdk.handle` writes the cookie. `/auth/refresh?returnTo=/current/path` refreshes on demand. A refresh token is only issued if your client/scopes allow it (often `offline_access`). Logout: link to `/auth/logout` (IdP end-session, then `postLogoutRedirectUri`, or a same-origin `?returnTo=` registered as a post-logout redirect URI) or `/auth/revoke` (no IdP page), with `data-sveltekit-reload`. Client `ctx.logout()` does not clear the server cookie, so do not use it in this mode.
- The browser SDK never refreshes in server-managed mode: `checkAuthentication()` ignores `autoRefresh` when `serverSessionUri` is set. Server `load` functions run on every navigation and refresh there. In browser code, `ctx.refresh()` (or `ctx.sdk.refresh({ returnTo })`) does a full-page navigation to `` `${authUriPrefix}/refresh?returnTo=<current URL>` ``, which rotates the cookie and comes back.
- Client-managed: `autoRefresh` (default `true`) refreshes during `checkAuthentication()` within `refreshSkew` of expiry; `ctx.refresh()` forces it. Logout: `await ctx.logout({ postLogoutRedirectUri: location.origin })`.

### Back-channel logout

The default encrypted-cookie storage cannot delete sessions by `sid` (the route returns 501). Use `storage: createSessionIdCookieStorage(yourServerStorage)` from `@strivacity/sdk-svelte/server`, where the storage implements `deleteByLogoutToken`. `createServerMemoryStorage()` works for local testing only.

Further reading: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-svelte and https://docs.strivacity.com
