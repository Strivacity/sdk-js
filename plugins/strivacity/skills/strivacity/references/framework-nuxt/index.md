# Strivacity Nuxt Integration

Add Strivacity OIDC login to a Nuxt 4 app with the `@strivacity/sdk-nuxt` module. Sessions are server-managed by default: the module registers Nitro auth routes and keeps tokens in an encrypted http-only cookie. Client-managed sessions are an opt-in.

## Critical rules

- **Ask before creating or editing `.env` files**, and never read an existing `.env` / `.env.local` into context without explicit permission. Tell the user which variables to add instead.
- **The `cookieSecret` is server-only.** Pass it as `strivacity.cookieSecret` in `nuxt.config.ts`. The module keeps it in the private `runtimeConfig.strivacity` and strips it, together with the `*FactoryPath` options, from `runtimeConfig.public.strivacity`. Never put it under `runtimeConfig.public`, in a `NUXT_PUBLIC_*` variable, or in app code. There is no client cookieSecret: the client is a public PKCE client.
- **v4 is a prerelease on the npm `next` dist-tag** (`4.0.0-beta.x`). A plain `npm install @strivacity/sdk-nuxt` installs v3, which has a different API. Install with `@next` or an explicit 4.x version and pin it exactly.
- **Composables are auto-imported** (`useStrivacity`, `useSession`, `useNativeLogin`, `useNativeLoginContext`, plus the SDK utils and storages). Import types from `@strivacity/sdk-nuxt`. Explicit imports, for example in factory files, come from `@strivacity/sdk-nuxt/utils` or `@strivacity/sdk-nuxt/storages`. Do not add `@strivacity/sdk-core` or `@strivacity/sdk-vue`.
- **Server-managed is the default.** Unless you set it, the module sets `serverSessionUri` to `` `${authUrlPrefix}/login` ``. The routes and middleware are registered at build time, only when `serverSessionUri` is truthy, so restart or rebuild after changing it.
- **`useStrivacity()` is read-only during SSR.** The SDK instance exists only in the browser: a client-only plugin creates it at startup (also available as `useNuxtApp().$strivacity`). During SSR, `useStrivacity()` returns a per-request context derived from `useSession()`, so no state is shared between requests. Its refs and `sdk.options` / `sdk.session` are readable, `checkAuthentication()` / `init()` resolve immediately, subscriptions are no-ops, and `login()`, `register()`, `logout()`, `handleCallback()`, `refresh()`, `revoke()`, `entry()`, `tokenExchange()` (and the matching `sdk.*` methods) throw. Call those from `onMounted` or event handlers.
- **Pick the mode first.** The quick start uses `mode: 'redirect'`. Mode-specific UI is covered by a separate mode reference loaded next to this one. Only `mode` and the login UI change between modes.

## Prerequisites

- Nuxt `>=4.0` (the `nuxt` peer dependency), with the `app/` source directory.
- A Strivacity application in the Admin Console:
  - `redirect` / `popup` mode: client type **"OIDC using no-code components"**.
  - `embedded` / `native` mode: client type **"OIDC using the Journey Flow API"**.
- Registered on that client: the redirect URI, for example `http://localhost:3000/callback`, and the post-logout redirect URI. The default is the origin of `redirectUri`, for example `http://localhost:3000`.
- Optional: Back-channel logout URI `https://<your-app>/auth/backchannel-logout`. It needs a session-id storage, see Patterns.

## When NOT to use

- A Vue SPA without Nuxt: use the Vue integration (`@strivacity/sdk-vue`).
- Nuxt 3 or Nuxt 2: not supported by this package version (peer `nuxt >=4.0`).
- Fully static output (`nuxi generate`, no Nitro server): the auth routes cannot run. Use client-managed sessions (see below), or a separate BFF.
- Next.js, SvelteKit, SolidStart, Angular: use the matching framework integration.

## Quick start

### 1. Install

```bash
npm install @strivacity/sdk-nuxt@next
# or pin the exact version you tested, e.g.
npm install --save-exact @strivacity/sdk-nuxt@4.0.0-beta.1
```

### 2. Environment variables

`nuxt.config.ts` reads them when it is evaluated (`nuxi dev`, `nuxi build`). Ask the user before writing:

```bash
# .env
STRIVACITY_ISSUER="https://<your-cluster-domain>"
STRIVACITY_CLIENT_ID="<your-client-id>"
STRIVACITY_REDIRECT_URI="http://localhost:3000/callback"
STRIVACITY_COOKIE_SECRET="<output of: openssl rand -base64 32>"
```

The values end up in the server build (`.output/server`). To supply the secret only at runtime, keep the key defined at build time (`cookieSecret: process.env.STRIVACITY_COOKIE_SECRET ?? ''`) and set `NUXT_STRIVACITY_COOKIE_SECRET` when the server starts. Nuxt uses that variable to override `runtimeConfig.strivacity.cookieSecret`.

### 3. Register and configure the module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native' - chosen separately
		issuer: process.env.STRIVACITY_ISSUER,
		clientId: process.env.STRIVACITY_CLIENT_ID,
		redirectUri: process.env.STRIVACITY_REDIRECT_URI,
		scopes: ['openid', 'profile', 'email'],
		cookieSecret: process.env.STRIVACITY_COOKIE_SECRET, // required unless storageFactoryPath is set
		postLoginRedirectUri: '/profile', // default: origin of redirectUri
		// serverSessionUri: '/auth/login', // default; false = client-managed (see below)
		// authUrlPrefix: '/auth', loginUri: '/login', postLogoutRedirectUri: '/', cookieMaxAge: 2592000
	},
	// embedded mode only: let Vue treat <sty-*> tags as custom elements
	vue: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('sty-') } },
});
```

That is the whole server setup. The module registers `GET /auth/{login,register,callback,refresh,revoke,entry,logout}` and `POST /auth/backchannel-logout` as Nitro routes. It adds a Nitro plugin that puts the Server SDK on `event.context.strivacity.sdk`, and a global route middleware that loads the cookie session into `useSession()` on every server render, without `refresh_token` and `id_token`. During that render it also refreshes a near-expiry session (`getSession()`: refresh token present, within `refreshSkew`), writes the rotated cookie to the response, and strips the tokens with `toClientSession()`. If the refresh fails, `useSession()` is `undefined`. There is no provider component.

### 4. Login, register, logout UI

In server-managed mode these are plain links to the Nitro routes. Use `<a>` (or `navigateTo(url, { external: true })`), not `<NuxtLink>`, because they must be full page loads. Do not call `useStrivacity().logout()` for this: it only clears the browser state and never clears the server cookie. `/auth/logout?returnTo=/some/path` comes back to a same-origin path (registered as a post-logout redirect URI) instead of `postLogoutRedirectUri`.

```vue
<!-- app/components/AuthHeader.vue -->
<script setup lang="ts">
const session = useSession(); // per-request on the server, hydrated in the browser

const name = computed(() => session.value?.claims?.given_name ?? session.value?.claims?.sub);
</script>

<template>
	<header>
		<template v-if="session">
			<span>Hello, {{ name }}</span>
			<NuxtLink to="/profile">Profile</NuxtLink>
			<a href="/auth/logout">Log out</a>
		</template>
		<template v-else>
			<a href="/auth/login?returnTo=/profile">Log in</a>
			<a href="/auth/register">Sign up</a>
		</template>
	</header>
</template>
```

The guard below sends anonymous users to `/login?returnTo=...`. `loginUri` (default `/login`) is also where `/auth/entry` sends embedded/native entry links. So provide that page and forward to the auth route:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
const route = useRoute();
const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : undefined;

// Real HTTP 302 during SSR, location change in the browser. returnTo must be same-origin
await navigateTo({ path: '/auth/login', query: returnTo ? { returnTo } : {} }, { external: true });
</script>

<template>
	<p>Redirecting to login...</p>
</template>
```

### 5. Callback page

The IdP returns to `redirectUri` (`/callback`). Forward the query string to `/auth/callback`, which exchanges the code, sets the cookie and redirects to `returnTo` or `postLoginRedirectUri`. Alternatively, register `http://localhost:3000/auth/callback` itself as `redirectUri` and skip this page.

```vue
<!-- app/pages/callback.vue -->
<script setup lang="ts">
const route = useRoute();

await navigateTo({ path: '/auth/callback', query: route.query }, { external: true });
</script>

<template>
	<p>Signing you in...</p>
</template>
```

Auth-route failures redirect to `/error?type=...&error=...&error_description=...`, so add `app/pages/error.vue`. That is a route, unlike `app/error.vue`, which is Nuxt's error page:

```vue
<!-- app/pages/error.vue -->
<script setup lang="ts">
const route = useRoute();
</script>

<template>
	<h1>Login failed</h1>
	<p>{{ route.query.error_description ?? route.query.error ?? 'Unknown error' }}</p>
	<a href="/auth/login">Try again</a>
</template>
```

### 6. Protected routes

The module's global middleware loads (and, near expiry, refreshes) the session but never redirects. Protect pages with your own middleware: a named one applied per page, or `auth.global.ts` for every page (exclude `/login` and the other public routes). The module's middleware runs before all app middleware, global ones included, so during SSR `useSession()` is already the fresh session, or `undefined` when there is no session or the refresh failed. On client-side navigations the middleware runs in the browser, where the hydrated `useSession()` ages while the tab stays open and is never refreshed. There, send an expired session through the refresh route (`sdk.refresh({ returnTo })` does a full-page navigation to `` `${authUrlPrefix}/refresh?returnTo=...` ``, which rotates the cookie and comes back) and cancel the navigation:

```ts
// app/middleware/auth.ts  (or auth.global.ts to protect every page - then skip /login and other public routes)
export default defineNuxtRouteMiddleware(async (to) => {
	const session = useSession().value;

	// undefined: no session, or the module could not refresh a near-expiry one
	if (!session) {
		return navigateTo({ path: '/login', query: { returnTo: to.fullPath } });
	}

	// Client-side navigation with an expired hydrated session (during SSR it is always fresh)
	const { sdk } = useStrivacity();

	if (import.meta.client && isSessionExpired(session)) {
		await sdk.refresh({ returnTo: to.fullPath });
		return abortNavigation();
	}
});
```

```vue
<!-- app/pages/profile.vue -->
<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });

const session = useSession();
</script>

<template>
	<section>
		<h1>{{ session?.claims?.email }}</h1>
		<pre>{{ session?.claims }}</pre>
	</section>
</template>
```

### 7. Claims and tokens

- **Pages and components (SSR-safe):** `useSession().value` is the `SessionData` without the long-lived credentials: `claims`, `access_token` and `expires_at` (Unix seconds). The module strips `refresh_token` and `id_token` before hydration. They stay in the cookie for server-side refresh and `/auth/logout`.
- **Server routes:** `event.context.strivacity.sdk` is the Server SDK for that request. The server auto-import `useStrivacity(event)` returns the same object, but `nuxi typecheck` resolves that name to the client composable in typed-route checks, so prefer the context property:

```ts
// server/api/me.get.ts
export default defineEventHandler(async (event) => {
	const session = await event.context.strivacity.sdk.getSession();

	if (!session) {
		throw createError({ statusCode: 401, statusMessage: 'not_authenticated' });
	}

	return { sub: session.claims?.sub, email: session.claims?.email };
});
```

- **`useStrivacity()`:** returns `Ref`s (`loading`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired`, `accessTokenExpirationDate`), `sdk` and the methods. During SSR the refs are derived from `useSession()`: `loading` is `false` (server-managed), `refreshToken` is `null`. In the browser they track the SDK instance, which starts from the hydrated session. `refreshToken` stays `null` in server-managed mode, and the methods only work in the browser.

**The access token is in the page payload.** `useSession()` is `useState`, so the session (claims, access token, expiry) is serialized into the HTML for hydration. The refresh and ID tokens are not. If the access token must never reach the browser either, call upstream APIs only from server routes (see Patterns) and do not render the session into pages.

### Other modes in Nuxt (summary)

- `popup`: call `useStrivacity<PopupFlow>().login()` from a click handler (the SDK instance only exists in the browser). In server-managed mode the popup's `/auth/callback` returns a page that closes the popup and notifies the opener. Then run `location.reload()` so SSR picks up the new cookie.
- `embedded`: set the `isCustomElement` option shown above. Render `<sty-login>`, `<sty-notifications>` and `<sty-language-selector>` inside `<ClientOnly>`. In `onMounted`, call ``injectScript('sty-components', `${sdk.options.issuer}/assets/components/bundle.js`)``. `injectScript` is auto-imported.
- `native`: call `useNativeLogin({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })` in a page component rendered in the browser. It starts in `onMounted`. Render `state.value.forms` / `state.value.layout` yourself. Children read the same state with `useNativeLoginContext()`. In server-managed mode `onLogin` is not called: the SDK navigates to the server callback itself. In `onFallback(error)`, navigate to `error.url`.
- Entry links (password reset and similar) for embedded/native: `/auth/entry` redirects to `loginUri` with `session_id`, `short_app_id` and `language`. Client-managed apps call `entry()` on their own `/entry` page.

## Client-managed sessions (opt-in)

Set `serverSessionUri: false` in the `strivacity` config and restart. Then the module registers no Nitro routes, no global middleware and no server `useStrivacity(event)`. `useSession()` stays `undefined`, `cookieSecret` is unused, and tokens live in `localStorage`. The server cannot see them: during SSR `useStrivacity()` reports `isAuthenticated: false` and `loading: true` until the browser takes over. Everything happens in the browser, with the same API as the Vue integration:

```vue
<!-- app/pages/callback.vue (client-managed) -->
<script setup lang="ts">
const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
	const params = new URLSearchParams(window.location.search);

	if (params.get('error')) {
		return router.replace(`/error?${params.toString()}`);
	}

	try {
		await handleCallback(); // state check, PKCE code exchange, ID token validation, stores the session
		await router.replace('/profile');
	} catch (error) {
		await router.replace(`/error?error_description=${encodeURIComponent(error instanceof Error ? error.message : 'Login failed')}`);
	}
});
</script>

<template>
	<p>Signing you in...</p>
</template>
```

```ts
// app/middleware/auth.ts (client-managed)
export default defineNuxtRouteMiddleware(async () => {
	if (import.meta.server) {
		return; // localStorage is not visible during SSR. The browser re-runs this middleware
	}

	const { sdk } = useStrivacity();

	// Loads the stored session first, and refreshes an expiring token (autoRefresh)
	if (!(await sdk.isAuthenticated)) {
		return navigateTo('/login');
	}
});
```

For login, register and logout, call `login()`, `register()` and `logout({ postLogoutRedirectUri: window.location.origin })` from `useStrivacity()` in click handlers or `onMounted`. Render user-dependent markup only once `loading` is `false` (it stays `true` during SSR), or wrap it in `<ClientOnly>`.

## Common mistakes

| Mistake                                                                                                                                                                                                                   | Fix                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install @strivacity/sdk-nuxt` installs v3                                                                                                                                                                            | Use `@strivacity/sdk-nuxt@next` or an exact `4.x` version, and pin it                                                                                                                                                          |
| Startup log `[@strivacity/sdk-nuxt] Failed to initialize the Strivacity server SDK: ConfigurationError: Missing SDK option: cookieSecret`, then pages and auth routes fail with `500 Strivacity SDK failed to initialize` | Set `strivacity.cookieSecret` (or `NUXT_STRIVACITY_COOKIE_SECRET` at runtime), or set `storageFactoryPath`. The server keeps running, but every use of the Server SDK throws                                                   |
| 404 on `/auth/login`                                                                                                                                                                                                      | `serverSessionUri` is falsy, or the dev server was not restarted after changing it. Routes are registered at build time                                                                                                        |
| `<NuxtLink to="/auth/login">` shows a Nuxt 404 page                                                                                                                                                                       | Auth routes are server handlers. Use `<a href>` or `navigateTo(url, { external: true })`                                                                                                                                       |
| `[@strivacity/sdk-nuxt] login() is only available in the browser. During SSR, useStrivacity() is read-only.`                                                                                                              | An auth method ran during SSR (in `setup` or a middleware). Call it from `onMounted`, an event handler, or skip it when `import.meta.server`                                                                                   |
| Protected page reachable without login                                                                                                                                                                                    | The module's global middleware never redirects. Add `definePageMeta({ middleware: ['auth'] })` to protected pages, or use `auth.global.ts`                                                                                     |
| Guarded page renders with an expired token                                                                                                                                                                                | Every server render refreshes near-expiry sessions. Only the hydrated `useSession()` ages while the tab stays open: refresh in the auth middleware (step 6), or call `sdk.refresh()` before browser code uses its access token |
| Client-managed: logged-in user bounced to login on hard reload                                                                                                                                                            | The middleware ran during SSR, where `localStorage` is empty. Return early when `import.meta.server`                                                                                                                           |
| `/error` shows Nuxt's error screen                                                                                                                                                                                        | Add `app/pages/error.vue`. Auth routes redirect there on failure                                                                                                                                                               |
| `redirect_uri` mismatch                                                                                                                                                                                                   | `redirectUri` must exactly match the Admin Console entry. With the forwarding page that is `/callback`, not `/auth/callback`                                                                                                   |
| "State not found or expired" on `/auth/callback` in production                                                                                                                                                            | Default login-state storage is in-process memory. On serverless or multi-instance hosting, set `stateStorageFactoryPath` to a shared store                                                                                     |
| `storageFactoryPath: '~/server/...'` not found                                                                                                                                                                            | In Nuxt 4, `~` is `app/`. Use `~~/server/...` for the project root                                                                                                                                                             |
| Hosted page errors, or embedded/native fails to start                                                                                                                                                                     | Client type must match mode: redirect/popup need "OIDC using no-code components"; embedded/native need "OIDC using the Journey Flow API"                                                                                       |
| Back-channel logout returns `501`                                                                                                                                                                                         | The default encrypted-cookie storage cannot delete by `sid`. Use a session-id storage via `storageFactoryPath`                                                                                                                 |
| Logout ends on a Strivacity error page                                                                                                                                                                                    | Register `postLogoutRedirectUri` (default: origin of `redirectUri`) on the client                                                                                                                                              |

## API quick reference

### Module options (`strivacity` key in `nuxt.config.ts`)

- All client SDK options: `mode`, `issuer`, `clientId`, `redirectUri` (required), `scopes` (`['openid']`), `responseType` (`'code'`), `responseMode` (`'query'`), `storageTokenName` (`'sty.session'`, also the cookie name), `autoRefresh` (`true`), `refreshSkew` (`60`), `lazyLoad` (`false`), `discoveryDocumentCacheTTL` (`3600`), `jwksCacheTTL` (`600`).
- Server options:
  - `serverSessionUri`: default `` `${authUrlPrefix}/login` ``. Set `false` / `null` for client-managed sessions.
  - `authUrlPrefix`: `'/auth'`. Shared with the browser SDK, whose `refresh()` navigates to `` `${authUrlPrefix}/refresh` ``.
  - `loginUri`: `'/login'`.
  - `postLoginRedirectUri` / `postLogoutRedirectUri`: default origin of `redirectUri`.
  - `cookieMaxAge`: `2592000`.
  - `cookieSecret`: required unless `storageFactoryPath` is set.
- Functions cannot live in `nuxt.config.ts`, so pass them as paths to modules with a default-exported factory: `storageFactoryPath`, `stateStorageFactoryPath`, `loggingFactoryPath`, `httpClientFactoryPath`. The logging and HTTP-client factories also run in the browser.

### Auto-imports

- App:
  - `useStrivacity<Flow>()` (same context as `useNuxtApp().$strivacity` in the browser, read-only during SSR): returns `sdk`, `loading`, `language`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired`, `accessTokenExpirationDate` (all `Ref`s) and `init`, `login`, `register`, `logout`, `handleCallback`, `refresh`, `revoke`, `checkAuthentication`, `tokenExchange`, `entry`, `subscribeToEvent`, `subscribeToAllEvents`.
  - `useSession()`: `Ref<SessionData | undefined>`.
  - `useNativeLogin(options)`: returns `loading`, `state`, `forms`, `messages`, `submitForm`, `setFormValue`, `setMessage`, `triggerFallback`, `triggerClose`.
  - `useNativeLoginContext()`.
  - SDK utils and storages, for example `isSessionExpired`, `toClientSession`, `injectScript`, `createDefaultLogging`, `FallbackError`, `createLocalStorage`.
- Server (server-managed only):
  - `useStrivacity(event)` / `event.context.strivacity.sdk`: the `NuxtServerSDK`, with `options`, `getSession()` (refreshes a near-expiry session once per request, `null` when that fails; `getSession(undefined, { autoRefresh: false })` reads it as stored), `updateSession(session)`, `refreshSession()`, `revokeSession()`, `completeLogin(params)`, `logout(postLogoutRedirectUri)`, `getEntrySession(url)`. These methods are bound to the event. The route handlers `handleLogin(event)` ... `handleBackChannelLogout(event)` and `handler(event)` still take the event.
  - `createEncryptedCookieStorage(secret, options?)`, `createSessionIdCookieStorage(storage, options?)`, `createServerMemoryStorage()`.

Auth route query params: `/auth/login` and `/auth/register` accept `returnTo` (same origin only), `prompt`, `display`, `login_hint`, `acr_values`, `ui_locales`, `audience` (space-separated).

Responses:

- `/auth/refresh`: `302` to `returnTo`, otherwise `204`.
- `/auth/revoke` and `/auth/logout`: `302`. `/auth/logout` accepts a same-origin `returnTo` (otherwise `postLogoutRedirectUri`).
- `/auth/entry`: `302` to `loginUri`.
- `/auth/backchannel-logout`: `200`, `400` or `501`.

Client `login()` / `register()` params: `prompt`, `display`, `loginHint`, `acrValues[]`, `uiLocales[]` and `audiences[]`. In server-managed mode they are forwarded to `serverSessionUri` as query params.

## Patterns

### Call a protected API (server-side, token stays on the server)

```ts
// server/api/orders.get.ts
export default defineEventHandler(async (event) => {
	// Refreshes a near-expiry session first (the default cookie storage writes the rotated cookie to this response)
	const session = await event.context.strivacity.sdk.getSession();

	if (!session?.access_token) {
		throw createError({ statusCode: 401, statusMessage: 'not_authenticated' });
	}

	return $fetch('https://api.example.com/orders', { headers: { Authorization: `Bearer ${session.access_token}` } });
});
```

Call it from pages with `useFetch('/api/orders')`. During SSR, Nuxt forwards the request cookies. Request the API audience at login with `/auth/login?audience=https://api.example.com`.

### Custom session storage and back-channel logout

```ts
// server/strivacity/storage.ts  ->  strivacity: { storageFactoryPath: '~~/server/strivacity/storage' }
import { createSessionIdCookieStorage, createServerMemoryStorage } from '#imports';

// Only a random session-id cookie goes to the browser. Replace the memory storage (testing only)
// with Redis or similar that implements get/set/delete/deleteByLogoutToken
export default function createStorage() {
	return createSessionIdCookieStorage(createServerMemoryStorage());
}
```

Register `https://<your-app>/auth/backchannel-logout` as the client's back-channel logout URI. A shared `stateStorageFactoryPath` works the same way: the factory default-exports a function that returns `{ get, set, delete }`.

### Logging

```ts
// app/lib/strivacity-logging.ts  ->  strivacity: { loggingFactoryPath: '~/lib/strivacity-logging' }
import { createDefaultLogging } from '@strivacity/sdk-nuxt/utils';

export default createDefaultLogging;
```

### Token refresh and logout

- Server-managed: every server render refreshes a near-expiry session automatically (the module's global middleware). In the browser, `sdk.refresh({ returnTo })` (`useStrivacity().refresh({ returnTo })` works the same) navigates to `/auth/refresh?returnTo=...` on demand. In a server route, `await event.context.strivacity.sdk.getSession()` refreshes only when needed, `refreshSession()` always. A refresh token is only issued if the client and scopes allow it (often `offline_access`). Logout: `/auth/logout` clears the cookie and goes to the IdP end-session endpoint, then back to a same-origin `?returnTo=` (register it as a post-logout redirect URI) or `postLogoutRedirectUri`. The client `logout()` from `useStrivacity()` does not clear the cookie, so navigate to `/auth/logout`. The browser SDK never refreshes in this mode (`autoRefresh` is ignored when `serverSessionUri` is set). `/auth/revoke` revokes tokens and redirects to `postLogoutRedirectUri`.
- Client-managed: `autoRefresh` (default `true`) refreshes during `sdk.isAuthenticated` / `checkAuthentication()` once the token is within `refreshSkew` (60 s) of expiry. `refresh()` forces it. Logout: `await logout({ postLogoutRedirectUri: window.location.origin })`.

### Subscribe to SDK events (browser)

Events: `init`, `sessionLoaded`, `loginInitiated`, `flowInitiated`, `loggedIn`, `sessionUpdated`, `tokenRefreshed`, `tokenRefreshFailed`, `accessTokenExpired`, `tokenRevoked`, `tokenRevokeFailed`, `logoutInitiated`, `sessionCleared`. `accessTokenExpired` fires once, when the SDK loads a stored session whose access token has already expired. Subscribe in `onMounted` with `const sub = useStrivacity().subscribeToEvent('loggedIn', cb)` and call `sub.dispose()` in `onUnmounted`.

Further reading: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-nuxt and https://docs.strivacity.com
