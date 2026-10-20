# Strivacity Vue Integration

Add Strivacity OIDC (PKCE) login to a Vue 3 single-page app (Vite) with the `@strivacity/sdk-vue` plugin and composables.

## Critical rules

- **Ask before creating or editing `.env` / `.env.local`.** Propose the variable names and values, and write the file only after the user agrees.
- **Never read existing `.env*` files without explicit permission.** They can hold secrets. Ask the user which variables already exist.
- **Public PKCE client only.** Browser code must never contain a client secret. The SDK uses `token_endpoint_auth_method: none` with PKCE (S256). If the user has a client secret, it belongs to a backend (see "When NOT to use").
- **v4 is a pre-release.** `@strivacity/sdk-vue` v4 is published under the npm `next` dist-tag (`4.0.0-beta.x`). Install with `@next` or an explicit 4.x version, and pin the exact version in `package.json`. A plain `npm install @strivacity/sdk-vue` installs the older `latest` major, which has a different API.
- **Import everything from `@strivacity/sdk-vue`.** It re-exports the core flows, handlers, utils, storages, errors and types. Do not add or import `@strivacity/sdk-core` directly in a Vue app.
- Call `useStrivacity()` / `useNativeLogin()` only inside `setup()` (or `<script setup>`) and inside vue-router guards, where Vue's `inject()` works.

## Prerequisites

- Vue `>=3.3` (peer dependency of `@strivacity/sdk-vue`). The examples use `vue-router` 4 and Vite.
- A Strivacity application client in the Admin Console. You need:
  - **Issuer**: your cluster domain, for example `https://<your-cluster-domain>`
  - **Client ID**: `<your-client-id>`
  - **Redirect URI** registered on the client, exactly matching `redirectUri` (scheme, host, port, path). For example `http://localhost:5173/callback` in dev.
  - **Post-logout redirect URI** registered if you pass `postLogoutRedirectUri` to `logout()`.
- Client type must match the `mode` (see Common mistakes): `redirect` / `popup` need "OIDC using no-code components". `embedded` / `native` need "OIDC using the Journey Flow API".

## When NOT to use

- Nuxt apps: use the Nuxt integration (`@strivacity/sdk-nuxt`). It registers server routes and keeps tokens server-side.
- Server-side rendering of any kind (Vue SSR, Vite SSR, Quasar SSR). `@strivacity/sdk-vue` is a browser SPA SDK and touches `window`, `localStorage` and `sessionStorage`.
- Tokens must never reach browser JavaScript (stricter security requirement): keep this SDK for the UI, but pair it with a backend-for-frontend by setting `serverSessionUri`. That setup is covered by the server-managed sessions (BFF) reference.
- Machine-to-machine or confidential clients with a client secret: use a backend OIDC library instead.

## Quick start

The quick start uses `mode: 'redirect'`. The login mode is chosen separately (a mode reference is loaded alongside this one). Only the `mode` value in `main.ts` and the login component change between modes.

### 1. Install

```bash
npm install @strivacity/sdk-vue@next vue-router@4
# then pin the resolved version, e.g. "@strivacity/sdk-vue": "4.0.0-beta.1"
```

### 2. Environment variables

Ask the user before writing this file. Vite only exposes variables prefixed with `VITE_` to the browser. None of these values are secret.

```bash
# .env.local
VITE_STRIVACITY_ISSUER="https://<your-cluster-domain>"
VITE_STRIVACITY_CLIENT_ID="<your-client-id>"
VITE_STRIVACITY_REDIRECT_URI="http://localhost:5173/callback"
```

```ts
// src/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_STRIVACITY_ISSUER: string;
	readonly VITE_STRIVACITY_CLIENT_ID: string;
	readonly VITE_STRIVACITY_REDIRECT_URI: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
```

### 3. Register the plugin and router (`src/main.ts`)

`createStrivacitySDK(options)` returns a Vue plugin. It creates the SDK once and provides it to every component through `provide`/`inject`. Install it before the router so route guards can use it on the first navigation.

```ts
// src/main.ts
import { createApp } from 'vue';
import { createRouter, createWebHistory, type NavigationGuard } from 'vue-router';
import { createStrivacitySDK, createDefaultLogging, useStrivacity } from '@strivacity/sdk-vue';
import App from './App.vue';
import Home from './pages/Home.vue';
import Callback from './pages/Callback.vue';
import Profile from './pages/Profile.vue';
import ErrorPage from './pages/Error.vue';

const requireAuth: NavigationGuard = async () => {
	const { sdk } = useStrivacity();

	if (!(await sdk.isAuthenticated)) {
		// isAuthenticated waits for the stored session to load, and refreshes an expiring token when autoRefresh is on
		await sdk.login();
		return false;
	}
	return true;
};

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: '/', component: Home },
		{ path: '/callback', component: Callback },
		{ path: '/error', component: ErrorPage },
		{ path: '/profile', component: Profile, beforeEnter: requireAuth },
	],
});

const app = createApp(App);

app.use(
	createStrivacitySDK({
		mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native' - see the mode reference
		issuer: import.meta.env.VITE_STRIVACITY_ISSUER,
		clientId: import.meta.env.VITE_STRIVACITY_CLIENT_ID,
		redirectUri: import.meta.env.VITE_STRIVACITY_REDIRECT_URI,
		scopes: ['openid', 'profile', 'email'],
		logging: import.meta.env.DEV ? createDefaultLogging() : undefined,
	}),
);
app.use(router);
app.mount('#app');
```

The Strivacity example app uses the same guard shape, but redirects to its own `/login` page (`return '/login'`) instead of calling `sdk.login()` directly. Either works.

### 4. Login, register and logout UI (`src/App.vue`)

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useStrivacity, type RedirectFlow } from '@strivacity/sdk-vue';

const { loading, isAuthenticated, idTokenClaims, login, register, logout } = useStrivacity<RedirectFlow>();

const name = computed(() => idTokenClaims.value?.given_name ?? idTokenClaims.value?.email ?? idTokenClaims.value?.sub);

const onLogin = () => login();
const onRegister = () => register(); // same as login({ prompt: 'create' })
const onLogout = () => logout({ postLogoutRedirectUri: window.location.origin });
</script>

<template>
	<header v-if="!loading">
		<template v-if="isAuthenticated">
			<span>Welcome, {{ name }}</span>
			<RouterLink to="/profile">Profile</RouterLink>
			<button @click="onLogout">Log out</button>
		</template>
		<template v-else>
			<button @click="onLogin">Log in</button>
			<button @click="onRegister">Sign up</button>
		</template>
	</header>
	<RouterView />
</template>
```

### 5. Callback route (`src/pages/Callback.vue`)

The route at `redirectUri` must call `handleCallback()`. It reads the query string, checks `state`, exchanges the code with PKCE, validates the ID token and stores the session.

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const { handleCallback } = useStrivacity();
const router = useRouter();

onMounted(async () => {
	const params = new URLSearchParams(window.location.search);

	if (params.get('error')) {
		return router.replace(`/error?${params.toString()}`);
	}

	try {
		await handleCallback(); // defaults to window.location.href
		await router.replace('/profile');
	} catch (error) {
		await router.replace(`/error?error_description=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template>
	<p>Signing you in...</p>
</template>
```

### 6. Read claims and the access token (`src/pages/Profile.vue`)

All state values are Vue `Ref`s. Use `.value` in script, and use them directly in templates.

```vue
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';

const { idTokenClaims, accessToken, accessTokenExpirationDate } = useStrivacity();
</script>

<template>
	<section>
		<h1>{{ idTokenClaims?.email }}</h1>
		<pre>{{ idTokenClaims }}</pre>
		<p>Access token expires at {{ accessTokenExpirationDate ? new Date(accessTokenExpirationDate * 1000).toLocaleString() : 'n/a' }}</p>
		<p>Has access token: {{ !!accessToken }}</p>
	</section>
</template>
```

### Other modes in Vue

`mode` is the only plugin option that changes. How each mode plugs into components:

- **popup**: same `login()` / `register()` calls (type with `useStrivacity<PopupFlow>()`). The promise resolves after the popup finishes, and then you navigate. Keep the `/callback` route calling `handleCallback()`: it runs inside the popup and posts the result to the opener window. Popup params: `popupWindowFeatures`, `popupWindowTarget`, `checkOrigin`.
- **embedded**: no composable. Load the components with `injectScript('sty-components', \`${issuer}/assets/components/bundle.js\`)`(exported from`@strivacity/sdk-vue`). Render `<sty-login>`(props:`params`, `sessionId`, `shortAppId`, `lang`; events: `login`, `close`, `error`), plus optionally `<sty-notifications>`and`<sty-language-selector>`. Tell Vue these are custom elements in `vite.config.ts`: `vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('sty-') } } })`.
- **native**: `useNativeLogin(options)` returns `{ loading, forms, messages, state, submitForm, setFormValue, setMessage, triggerFallback, triggerClose }`. Options: `params`, `onLogin`, `onFallback`, `onClose`, `onError`, `onGlobalMessage`. Render `state.value.forms` / `state.value.layout` yourself. In `onFallback(error)`, navigate to `error.url`. Child components can read the same context with `useNativeLoginContext()`.

## Common mistakes

| Mistake                                                                                              | Symptom                                                                  | Fix                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `mode` does not match the Admin Console client type                                                  | Login page errors, or `embedded`/`native` fail to start a session        | `redirect`/`popup` need "OIDC using no-code components". `embedded`/`native` need "OIDC using the Journey Flow API" |
| `redirectUri` not registered, or different (port, trailing slash, http vs https)                     | IdP shows a redirect URI error                                           | Register the exact URI. Use a separate value per environment                                                        |
| No route at `redirectUri`, or the route does not call `handleCallback()`                             | User returns with `?code=...` but stays logged out                       | Add the callback route from step 5 (also needed for `popup`)                                                        |
| Reading `isAuthenticated.value` before the SDK has loaded the stored session                         | Logged-in users are bounced to login on refresh                          | In guards, `await sdk.isAuthenticated` (it awaits `init()` itself). In templates, render after `loading` is `false` |
| Importing from `@strivacity/sdk-core`                                                                | Duplicate SDK copies, version mismatches                                 | Import from `@strivacity/sdk-vue` only                                                                              |
| Installing without `@next`                                                                           | Old major installed, `createStrivacitySDK` options or composables differ | `npm install @strivacity/sdk-vue@next`, then pin the exact version                                                  |
| Calling `useStrivacity()` outside setup or a guard (for example in a plain module or a `setTimeout`) | `Missing SDK context` error                                              | Call it in `setup()`, or capture the returned object in setup and pass it on                                        |
| Destructuring `.value` early (`const claims = idTokenClaims.value`)                                  | UI does not update after login or refresh                                | Keep the `Ref`, or wrap it in `computed()`                                                                          |
| `<sty-login>` not marked as a custom element                                                         | Vue warns "Failed to resolve component"                                  | Add `isCustomElement` in the Vite Vue plugin config                                                                 |
| Passing a `postLogoutRedirectUri` that is not registered                                             | User stays on the Strivacity logged-out page                             | Register it on the client in the Admin Console                                                                      |

## API quick reference

### Plugin

```ts
import { createStrivacitySDK } from '@strivacity/sdk-vue';
app.use(createStrivacitySDK(options: SDKInitConfig));
```

`SDKInitConfig` = `Partial<SDKOptions>` with `mode`, `issuer`, `clientId` and `redirectUri` required.

### `useStrivacity<Flow>()` return value (`SDKContext<Flow>`)

| Member                                                    | Type                         | Notes                                                                                                                                                                           |
| --------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdk`                                                     | `Flow`                       | Raw flow instance (`RedirectFlow`, `PopupFlow`, `EmbeddedFlow`, `NativeFlow`). Has `init()`, `isAuthenticated` (Promise), `session`, `idToken`, `options`, `updateSession()`... |
| `loading`                                                 | `Ref<boolean>`               | `false` after the first auth-state check                                                                                                                                        |
| `language`                                                | `Ref<string>`                | BCP 47, defaults to `navigator.language`                                                                                                                                        |
| `isAuthenticated`                                         | `Ref<boolean>`               |                                                                                                                                                                                 |
| `idTokenClaims`                                           | `Ref<IdTokenClaims \| null>` |                                                                                                                                                                                 |
| `accessToken`                                             | `Ref<string \| null>`        |                                                                                                                                                                                 |
| `refreshToken`                                            | `Ref<string \| null>`        |                                                                                                                                                                                 |
| `accessTokenExpired`                                      | `Ref<boolean>`               |                                                                                                                                                                                 |
| `accessTokenExpirationDate`                               | `Ref<number \| null>`        | Unix seconds                                                                                                                                                                    |
| `init()`                                                  | `Promise<void>`              | Loads the stored session. Safe to call many times                                                                                                                               |
| `login(params?)` / `register(params?)`                    | `Promise<void>`              | Params = `ExtraRequestArgs` plus mode params (`locationMethod`, `targetWindow` for redirect)                                                                                    |
| `handleCallback(url?)`                                    | `Promise<{ returnTo? }>`     | Defaults to the current URL. Resolves to the `returnTo` given to `login()`                                                                                                      |
| `logout(params?)`                                         | `Promise<void>`              | `{ postLogoutRedirectUri?: string }`                                                                                                                                            |
| `refresh()` / `revoke()`                                  | `Promise<void>`              |                                                                                                                                                                                 |
| `checkAuthentication(params?)`                            | `Promise<boolean>`           | `{ autoRefresh: boolean }`. Awaits `init()` first, same as `sdk.isAuthenticated`                                                                                                |
| `tokenExchange(params?)`                                  | `Promise<void>`              |                                                                                                                                                                                 |
| `entry(url?, params?)`                                    | flow-dependent               | Externally-initiated flows (for example password reset links)                                                                                                                   |
| `subscribeToEvent(name, fn)` / `subscribeToAllEvents(fn)` | `{ dispose() }`              |                                                                                                                                                                                 |

Other exports: `useNativeLogin`, `useNativeLoginContext`, `injectScript`, `createDefaultLogging`, storages (`createLocalStorage`, `createSessionStorage`, `createMemoryStorage`, `createIndexedDBStorage`, `createCacheAPIStorage`, `createWorkerStorage`), error classes (`FallbackError`, `PopupBlockedError`, `PopupClosedError`, ...), types (`RedirectFlow`, `PopupFlow`, `NativeFlow`, `EmbeddedFlow`, `SDKOptions`, `IdTokenClaims`, `SessionData`).

### Key `SDKOptions`

| Option                                        | Default                  | Description                                                                                                                                                |
| --------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                                        | (required)               | `'redirect' \| 'popup' \| 'embedded' \| 'native'`                                                                                                          |
| `issuer`                                      | (required)               | `https://<your-cluster-domain>` (a trailing slash is stripped)                                                                                             |
| `clientId`                                    | (required)               |                                                                                                                                                            |
| `redirectUri`                                 | (required)               | Must be registered on the client                                                                                                                           |
| `scopes`                                      | `['openid']`             | Add `profile`, `email` for name/email claims                                                                                                               |
| `responseType`                                | `'code'`                 |                                                                                                                                                            |
| `responseMode`                                | `'query'`                | `'query' \| 'fragment'`                                                                                                                                    |
| `storage`                                     | `createLocalStorage()`   | Session storage adapter                                                                                                                                    |
| `stateStorage`                                | `createSessionStorage()` | PKCE/state storage                                                                                                                                         |
| `storageKey`                                  | `'sty.session'`          | Storage key. Change it when several apps share one origin                                                                                                  |
| `lazyLoad`                                    | `false`                  | When `false`, `init()` starts immediately. The plugin's first auth check runs it anyway                                                                    |
| `autoRefresh`                                 | `true`                   | Refresh with the refresh token when auth is checked and the token is near expiry                                                                           |
| `refreshSkew`                                 | `60`                     | Seconds before expiry that count as "expiring"                                                                                                             |
| `serverSessionUri`                            | `null`                   | BFF endpoint (string) to keep tokens server-side. See the server-managed sessions reference                                                                |
| `authUrlPrefix`                               | `'/auth'`                | Server SDK route prefix. With `serverSessionUri`, `refresh()` navigates to `${authUrlPrefix}/refresh`. Change it only to match a non-default server prefix |
| `discoveryDocumentCacheTTL`                   | `3600`                   | Seconds                                                                                                                                                    |
| `jwksCacheTTL`                                | `600`                    | Seconds                                                                                                                                                    |
| `logging`                                     | none                     | `createDefaultLogging()` or a custom `SDKLogging`                                                                                                          |
| `httpClient`, `urlHandler`, `callbackHandler` | per mode                 | Advanced overrides                                                                                                                                         |

### `ExtraRequestArgs` (for `login()` / `register()`)

| Arg         | Type               | Sent as                                    |
| ----------- | ------------------ | ------------------------------------------ |
| `prompt`    | `string \| null`   | `prompt` (`'login'`, `'create'`, `'none'`) |
| `display`   | `string \| null`   | `display`                                  |
| `loginHint` | `string \| null`   | `login_hint`                               |
| `acrValues` | `string[] \| null` | `acr_values` (space-joined)                |
| `uiLocales` | `string[] \| null` | `ui_locales` (space-joined)                |
| `audiences` | `string[] \| null` | `audience` (space-joined)                  |

## Patterns

### Call a protected API with the access token

Check `await sdk.isAuthenticated` first. It refreshes the token if it is about to expire (`autoRefresh`), so the header gets a fresh token.

```ts
// src/composables/useApi.ts
import { useStrivacity } from '@strivacity/sdk-vue';

export function useApi() {
	const { sdk, accessToken } = useStrivacity();

	return async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
		if (!(await sdk.isAuthenticated)) {
			await sdk.login();
			throw new Error('Not authenticated');
		}

		const headers = new Headers(init.headers);
		headers.set('Authorization', `Bearer ${accessToken.value}`);

		return fetch(input, { ...init, headers });
	};
}
```

Call `useApi()` in `setup()` and use the returned function anywhere. If the API checks the audience, request it at login with `login({ audiences: ['https://api.example.com'] })`.

### Subscribe to SDK events

Event names: `init`, `sessionLoaded`, `loggedIn`, `sessionUpdated`, `sessionCleared`, `loginInitiated`, `flowInitiated`, `logoutInitiated`, `accessTokenExpired`, `tokenRefreshed`, `tokenRefreshFailed`, `tokenRevoked`, `tokenRevokeFailed`. `accessTokenExpired` fires once, when the SDK loads a stored session whose access token has already expired.

```vue
<script setup lang="ts">
import { onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const { subscribeToEvent } = useStrivacity();
const router = useRouter();

const loggedIn = subscribeToEvent('loggedIn', (params) => console.info('Logged in as', params?.claims?.sub));
const refreshFailed = subscribeToEvent('tokenRefreshFailed', () => void router.push('/'));

onUnmounted(() => {
	loggedIn.dispose();
	refreshFailed.dispose();
});
</script>
```

### Token refresh

- With `autoRefresh: true` (default), the SDK refreshes when auth state is checked (`sdk.isAuthenticated`, `checkAuthentication()`, plugin updates) and the access token expires within `refreshSkew` seconds (default 60). It needs a refresh token from the IdP. There is no background timer, so check auth before API calls as shown above. With `serverSessionUri` set the browser never refreshes (`autoRefresh` is ignored): `sdk.refresh({ returnTo })` does a full-page navigation to the BFF refresh route (`` `${authUrlPrefix}/refresh` ``, default `/auth/refresh`), which rotates the cookie and redirects back (`useStrivacity().refresh({ returnTo })` works the same; `returnTo` defaults to the current URL). If your SPA loads the BFF session into the SDK (`updateSession()`), send an expired one through it in the route guard:

```ts
// server-managed variant of requireAuth
const requireAuth: NavigationGuard = async (to) => {
	const { sdk } = useStrivacity();

	if (await sdk.isAuthenticated) {
		return true;
	}

	// Expired session from the BFF: refresh on the server and come back to the target route
	if (sdk.options.serverSessionUri && sdk.session) {
		await sdk.refresh({ returnTo: to.fullPath });
		return false;
	}

	await sdk.login(); // navigates to serverSessionUri
	return false;
};
```

- Manual refresh: `await refresh()`. On failure `tokenRefreshFailed` fires. The session is cleared, except after a network error or 5xx/429 server error, where it is kept so a later refresh can retry.
- `revoke()` revokes the refresh token (or the access token) and clears the local session without visiting the IdP logout page.

### Logout

```ts
const { logout } = useStrivacity();
await logout({ postLogoutRedirectUri: `${window.location.origin}/` });
```

`logout()` clears the local session, then redirects to the IdP end-session endpoint with `id_token_hint`. Register the `postLogoutRedirectUri` on the client. Without it, the user stays on the Strivacity logged-out page. If there is no ID token, `logout()` only clears the local session and does not redirect. In `popup` mode `logout()` also navigates the current window, it does not open a popup.

More detail: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-vue and https://docs.strivacity.com/reference/overview
