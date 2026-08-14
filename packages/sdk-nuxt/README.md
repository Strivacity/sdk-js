# @strivacity/sdk-nuxt

Nuxt SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication, server-managed sessions, and self-service account management to your Nuxt application.

> See the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/nuxt) for a complete, working reference implementation covering all four login modes.

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Client-side vs server-managed sessions](#client-side-vs-server-managed-sessions)
- [Quick start](#quick-start)
- [Login flows](#login-flows)
  - [redirect](#redirect-mode)
  - [popup](#popup-mode)
  - [embedded](#embedded-mode)
  - [native](#native-mode)
  - [Custom login session URI](#custom-login-session-uri)
- [Composables API](#composables-api)
- [Server API](#server-api)
- [Protecting pages](#protecting-pages)
- [Session storages](#session-storages)
- [SDK events](#sdk-events)
- [Back-channel logout](#back-channel-logout)
- [Configuration reference](#configuration-reference)

---

## Prerequisites

- Nuxt 4
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-nuxt
```

Register the module in `nuxt.config.ts` (see [Quick start](#quick-start) below for full configuration).

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],
});
```

---

## Choosing a mode

The SDK supports four login flow modes. Choose based on your UX and deployment requirements.

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where and how the login UI is rendered.

| Mode       | Login UI                                 | Best for                                     |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `redirect` | Strivacity hosted page                   | Standard web apps                            |
| `popup`    | Strivacity hosted page in a popup        | SPAs that must stay on the current page      |
| `embedded` | Strivacity web components in your page   | Branded login inside your own layout         |
| `native`   | Your own components driven by flow state | Full UI control, step-by-step form rendering |

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where the login UI lives and how the flow state is consumed.

---

## Client-side vs server-managed sessions

Unlike `@strivacity/sdk-vue`, `@strivacity/sdk-nuxt` always registers a set of server routes and a global SSR middleware (see [Server API](#server-api)) - no manual route mounting is required. What differs based on the `serverSideSession` option is **where the session lives**:

- **`serverSideSession: true`** (default) - tokens never reach the browser. They're stored in an encrypted, `httpOnly` cookie managed entirely server-side (see [`secret`](#configuration-reference)). On every SSR request, a global route middleware loads the session from that cookie into a shared `useSession()` state so pages can render as authenticated on the server, before any client-side JavaScript runs.
- **`serverSideSession: false`** - tokens are stored in the browser (`localStorage` by default), same as `@strivacity/sdk-vue`. The server routes exist but aren't required for the session itself.

---

## Quick start

### 1. Configure the module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],

	strivacity: {
		mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native'
		issuer: 'https://YOUR_TENANT.strivacity.com',
		clientId: 'YOUR_CLIENT_ID',
		redirectUri: 'https://your-app.example.com/auth/callback',
		scopes: ['openid', 'profile', 'email'],
		secret: process.env.NUXT_STRIVACITY_SECRET, // required when serverSideSession is true
	},
});
```

### 2. Use the auth state

Call `useStrivacity()` in any component to read the current authentication state and trigger login or logout - all composables are auto-imported, no explicit import needed.

```vue
<script setup lang="ts">
const { isAuthenticated, idTokenClaims, login, logout } = useStrivacity();
</script>

<template>
	<template v-if="isAuthenticated">
		<span>Hello, {{ idTokenClaims?.given_name }}</span>
		<button @click="logout()">Log out</button>
	</template>
	<button v-else @click="login()">Log in</button>
</template>
```

### 3. Guard authenticated pages

There is no built-in route guard component - define a route middleware using `useSession()` (populated server-side by the SDK's global middleware, see [Protecting pages](#protecting-pages)):

```ts
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
	const { sdk } = useStrivacity();
	const isAuthenticated = sdk.options.serverSideSession ? !!useSession().value : await sdk.isAuthenticated;

	if (!isAuthenticated) {
		const returnToCookie = useCookie('sty.returnTo', { sameSite: 'lax', path: '/' });
		returnToCookie.value = to.path;

		return navigateTo('/login');
	}
});
```

```vue
<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });
</script>
```

---

## Login flows

### redirect mode

The user is redirected to the Strivacity-hosted login page and then back to your app after authentication.

```vue
<script setup lang="ts">
const { login } = useStrivacity();

onMounted(async () => {
	await login({
		// Optional parameters
		loginHint: 'user@example.com', // pre-fill the identifier field
		acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
		audiences: ['https://api.example.com'], // extra access token audiences
	});
});
</script>
```

#### Handle the callback

The default redirect URI is `/auth/callback`, handled automatically by the SDK's server route - it exchanges the authorization code for tokens, stores the session, and redirects to `postLoginRedirectUri`. No page of your own is required, but your configured `redirectUri` must point at it.

### popup mode

The Strivacity login page opens in a separate window. After the user authenticates, the popup closes and the parent page receives the session automatically - no callback page needed.

Configuration is the same as `redirect` - just set `mode: 'popup'`. `login()` opens the popup automatically; pass `popupWindowTarget`/`popupWindowFeatures` to control its size and position.

### embedded mode

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`) - `sty-notifications` shows toast-style system notifications and `sty-language-selector` lets the user switch the login flow's language. Load the components bundle with `injectScript`, then mount the elements. Use Vue's `.` property-binding modifier for the `params` object (plain objects can't be represented as HTML attributes):

```vue
<script setup lang="ts">
const issuer = useRuntimeConfig().public.strivacity.issuer;
const router = useRouter();

const onLogin = () => router.push('/profile');
const onClose = () => globalThis.location.reload();
const onError = (errorOrEvent: Error | CustomEvent<string>) => alert(errorOrEvent instanceof Error ? errorOrEvent.message : errorOrEvent.detail);

onMounted(() => {
	// Load the web components bundle
	injectScript('sty-components', `${issuer}/assets/components/bundle.js`);
});
</script>

<template>
	<section>
		<sty-notifications></sty-notifications>
		<sty-login :params.prop="{}" @login="onLogin" @close="onClose" @error="onError"></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
```

#### Controlling when the flow starts

By default the login flow starts automatically as soon as `sty-login` connects to the DOM. Add the `lazy` attribute and a template ref to take manual control, then call `start()` when ready:

```vue
<script setup lang="ts">
const loginEl = useTemplateRef('loginEl');

async function onStartClick() {
	await loginEl.value?.start({
		loginHint: 'user@example.com', // pre-fill the identifier field
		acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
	});
}
</script>

<template>
	<button @click="onStartClick">Continue to login</button>
	<sty-login ref="loginEl" lazy :params.prop="{}"></sty-login>
</template>
```

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), point the link at `/auth/entry` - the server route resolves the challenge against the IDP and redirects to your login page (`loginUri`, default `/login`) with `session_id`, `short_app_id`, and `language` as query parameters. Read them from the route and pass them directly to the `sty-login` element.

### native mode

You build the entire login UI with your own components using the `useNativeLogin` composable. It drives the flow state and returns a `LoginContext`: `loading`, `forms` (current field values), `messages` (validation/info messages), `state` (the current `LoginFlowState` - `screen`, `forms` widget definitions, `layout`, `finalizeUrl`, ...), `submitForm`, `setFormValue`, `setMessage`, `triggerFallback`, `triggerClose`.

`useNativeLogin` also `provide()`s the context under the `STRIVACITY_LOGIN_CONTEXT` key, so any descendant component can read it with `useNativeLoginContext()` without prop drilling.

> The SDK does **not** ship ready-made widget components or a renderer for native mode - it only provides the state machine. Build your own widget components (or copy the ones from the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/nuxt/app/components/login)) that read/write state via `useNativeLoginContext()`, and a `WidgetRenderer` that walks `state.layout.items` (each item is either `{ type: 'widget', formId, widgetId }`, resolved by looking it up in `state.forms`, or a nested `{ type: 'vertical' | 'horizontal', items: [...] }` group) to decide what to render and in what order.

```vue
<script setup lang="ts">
import { WidgetRenderer, widgets } from '../components/login';

const router = useRouter();

const ctx = useNativeLogin({
	params: {
		// Optional parameters
		loginHint: 'user@example.com',
		acrValues: ['urn:strivacity:loa:2'],
		audiences: ['https://api.example.com'],
		loginSessionUri: '/auth/login/session',
	},
	onLogin: async () => {
		await router.push('/profile');
	},
	onClose: () => {
		globalThis.location.reload();
	},
	// called when the native flow cannot continue (e.g. unsupported step) - fall back to the hosted login page
	onFallback: (error) => {
		globalThis.location.href = error.url.toString();
	},
	onError: async (error) => {
		await router.push(`/error?error=${encodeURIComponent(error.message)}`);
	},
});
</script>

<template>
	<section v-if="ctx.loading.value || !ctx.state.value.screen">
		<p>Loading...</p>
	</section>
	<section v-else class="login-renderer">
		<component :is="widgets.layout" :formId="ctx.state.value.layout?.items?.[0]?.formId" :type="ctx.state.value.layout?.type" tag="form">
			<WidgetRenderer :items="ctx.state.value.layout?.items" />
		</component>
	</section>
</template>
```

#### Externally-initiated flows (entry)

Same as for embedded mode: point your Strivacity tenant's email link destination at `/auth/entry` to resolve `session_id`/`short_app_id`/`language`, then pass them via `params` to `useNativeLogin`.

---

### Custom login session URI

All four modes accept an optional `loginSessionUri` parameter to start the flow through your own server-side endpoint (e.g. a BFF) instead of the SDK's default IDP endpoint - useful when the request must be built/signed server-side. Sensitive OAuth2 parameters (`client_id`, `redirect_uri`, `scope`, PKCE, ...) are never sent to `loginSessionUri` - your endpoint is responsible for adding those itself; only the non-sensitive extras (`prompt`, `display`, `acrValues`, `loginHint`, `uiLocales`, `audiences`) are appended as query params.

Pass it to `login()`/`register()` (`redirect`/`popup`) or as part of `params` to `useNativeLogin()` (`native`). In this SDK, the built-in `/auth/login/session` route (registered automatically, see [Server API](#server-api)) already acts as a ready-made `loginSessionUri` target for server-managed sessions:

```ts
// redirect / popup
await login({ loginSessionUri: '/auth/login' });

// native
useNativeLogin({ params: { loginSessionUri: '/auth/login/session' } });
```

`embedded` mode supports the same parameter directly on the `<sty-login>` element - pass it via the `params` prop instead of letting it build the default IDP request:

```vue
<template>
	<sty-login :params.prop="{ loginSessionUri: '/auth/login/session' }"></sty-login>
</template>
```

---

## Composables API

All composables below are auto-imported by the module - no explicit `import` needed.

### `useStrivacity<T>()`

The main composable. Returns the full auth context (all fields except `sdk` are Vue `Ref`s):

```ts
type SDKContext<Flow> = {
	sdk: Flow;
	loading: Ref<boolean>;
	language: Ref<string>;
	isAuthenticated: Ref<boolean>;
	idTokenClaims: Ref<IdTokenClaims | null>;
	accessToken: Ref<string | null>;
	refreshToken: Ref<string | null>;
	accessTokenExpired: Ref<boolean>;
	accessTokenExpirationDate: Ref<number | null>;
	init: () => Promise<void>;
	login(params?: NativeParams): Promise<void>;
	register(params?: NativeParams): Promise<void>;
	logout(params?: { postLogoutRedirectUri?: string }): Promise<void>;
	refresh(): Promise<void>;
	revoke(): Promise<void>;
	entry(url?: string | URL): Promise<Record<string, string>>;
	handleCallback(url?: string | URL): Promise<void>;
	checkAuthentication(opts?: { autoRefresh?: boolean }): Promise<boolean>;
	getAccessToken(opts?: { autoRefresh?: boolean }): Promise<string | null>;
	tokenExchange(...): Promise<...>;
	subscribeToEvent<T extends keyof EventFunctions>(eventName: T, callbackFn: EventFunctions[T]): { dispose(): void };
	subscribeToAllEvents(callbackFn: (...params: unknown[]) => Promise<void> | void): { dispose(): void };
};
```

The generic parameter `T` can be `RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow` for type-safe access to flow-specific properties on `sdk`.

### `useNativeLogin(options)`

Manages a native login flow session - see [native mode](#native-mode). Options: `params` (`NativeParams`), `onLogin`, `onFallback`, `onClose`, `onError`, `onGlobalMessage`.

### `useNativeLoginContext()`

Reads the `LoginContext` provided by an ancestor `useNativeLogin()` call - throws if called outside of one. Used by widget components so they don't need the context passed down as props.

### `useSession()`

Returns a `Ref<SessionData | undefined>` - the session pre-hydrated server-side by the SDK's global SSR route middleware when `serverSideSession: true` (`undefined` on the client until the server response is hydrated, and always `undefined` when `serverSideSession: false`). Useful in route middleware and for server-authenticated rendering - see [Protecting pages](#protecting-pages).

---

## Server API

The module automatically registers the following routes under `authUrlPrefix` (default `/auth`) - no manual route mounting required:

| Route                           | Purpose                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET /auth/login`               | Starts a login session and redirects to the IDP (or your `loginSessionUri`, if the login was initiated with one)                |
| `GET /auth/login/session`       | Starts an **embedded**-mode login session server-side; used as the default `loginSessionUri` target for server-managed sessions |
| `GET /auth/register`            | Same as `/auth/login` with `prompt=create`                                                                                      |
| `GET /auth/callback`            | Exchanges the authorization code for tokens, stores the session, and redirects to `postLoginRedirectUri`                        |
| `GET /auth/refresh`             | Refreshes the access token using the stored refresh token                                                                       |
| `GET /auth/revoke`              | Revokes the current session's tokens and clears the session cookie                                                              |
| `GET /auth/entry`               | Resolves an externally-initiated flow challenge and redirects to the login page with its parameters                             |
| `GET /auth/logout`              | Deletes the local session and redirects to the IDP end-session endpoint                                                         |
| `POST /auth/backchannel-logout` | Receives IDP back-channel logout notifications - see [Back-channel logout](#back-channel-logout)                                |

> Note the route is spelled `/auth/backchannel-logout` (not `backchannel`) - this matches the SDK's actual registered route.

Server-side code (server routes, Nitro plugins, other server middleware) can access the SDK via the server-only `useStrivacity(event)` composable (auto-imported in server context):

```ts
// server/api/profile.get.ts
export default defineEventHandler(async (event) => {
	const sdk = useStrivacity(event);
	const session = await sdk.getSession();

	if (!session) {
		throw createError({ statusCode: 401 });
	}

	return { claims: session.claims };
});
```

`useStrivacity(event)` exposes: `getSession()`, `updateSession(session)`, `refreshSession()`, `revokeSession()`, `getEntrySession(entryUrl)`, `completeLogin(params)`, `logout(postLogoutRedirectUri)`.

### My Account API (server)

There is no dedicated server-side My Account wrapper - call the `@strivacity/sdk-core/utils/myaccount` functions directly from a server route, using the session's access token and the SDK options:

```ts
// server/api/account.get.ts
import * as myAccount from '@strivacity/sdk-core/utils/myaccount';

export default defineEventHandler(async (event) => {
	const sdk = useStrivacity(event);
	const session = await sdk.getSession();

	if (!session?.access_token) {
		throw createError({ statusCode: 401 });
	}

	return await (await myAccount.fetchAccountData({ token: session.access_token, options: event.context.strivacity.options })).json();
});
```

For the full method list see [`@strivacity/sdk-core` — My Account API](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core#my-account-api).

---

## Protecting pages

Use a Nuxt [route middleware](https://nuxt.com/docs/guide/directory-structure/app/middleware) with `useSession()` to guard pages - `useSession()` is populated server-side (during SSR) by the SDK's global middleware whenever `serverSideSession: true`:

```ts
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
	const { sdk } = useStrivacity();
	const isAuthenticated = sdk.options.serverSideSession ? !!useSession().value : await sdk.isAuthenticated;

	if (!isAuthenticated) {
		const returnToCookie = useCookie('sty.returnTo', { sameSite: 'lax', path: '/' });
		returnToCookie.value = to.path;

		return navigateTo('/login');
	}
});
```

```vue
<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });
</script>
```

To protect a server API route directly, check the session inside the handler instead (see the [Server API](#server-api) example above).

---

## Session storages

### Client-side

Tokens and session data are stored entirely on the client side. The default storage is `localStorage`, but you can swap it out by passing any of the built-in factory functions - or any object implementing `SDKStorage` (`get`, `set`, `delete`) - as the `storage` option.

| Storage          | Export                        | Persists across                                  |
| ---------------- | ----------------------------- | ------------------------------------------------ |
| `localStorage`   | `createLocalStorage()`        | browser restarts                                 |
| `sessionStorage` | `createSessionStorage()`      | tab lifetime                                     |
| `IndexedDB`      | `createIndexedDBStorage()`    | browser restarts, larger quota                   |
| `Cookie`         | `createCookieStorage(opts?)`  | configurable expiry                              |
| `Cache API`      | `createCacheAPIStorage()`     | browser restarts; works in Service Workers too   |
| `Memory`         | `createMemoryStorage()`       | page lifetime only                               |
| `Worker`         | `createWorkerStorage(worker)` | depends on the backing storage inside the Worker |

### Server-side

By default the session is stored in an encrypted, `httpOnly`, `sameSite=lax` cookie (chunked automatically if it exceeds ~3900 bytes) using the `secret` option for encryption and `cookieMaxAge` for expiry (default 30 days). Provide a custom storage instead via `storageFactoryPath` (and `stateStorageFactoryPath` for the short-lived PKCE state) in the module config - the referenced module should default-export a factory function returning an object implementing `SDKStorage`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],

	strivacity: {
		// ...
		storageFactoryPath: './server/storage/custom-session-storage',
	},
});
```

---

## SDK events

Subscribe to authentication lifecycle events via `subscribeToEvent` (one specific event) or `subscribeToAllEvents` (all events) on the client-side `useStrivacity()` composable. Both return a `{ dispose() }` handle.

| Event                | Payload                                 | When it fires                                                             |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `init`               | -                                       | SDK has finished initializing                                             |
| `sessionLoaded`      | `{ accessToken, refreshToken, claims }` | An existing session was read from storage on startup                      |
| `loginInitiated`     | -                                       | A login or registration redirect / popup has started                      |
| `loggedIn`           | `{ accessToken, refreshToken, claims }` | Tokens were received and stored after a successful login                  |
| `logoutInitiated`    | `{ idToken, claims }`                   | Logout was initiated, before the redirect to the IDP end-session endpoint |
| `tokenRefreshed`     | `{ accessToken, refreshToken, claims }` | Access token was silently refreshed                                       |
| `tokenRefreshFailed` | `{ refreshToken }`                      | A token refresh attempt failed (refresh token may be expired)             |
| `accessTokenExpired` | `{ accessToken, refreshToken }`         | The stored access token has passed its expiration time                    |
| `tokenRevoked`       | `{ token, tokenTypeHint }`              | A token was successfully revoked at the authorization server              |
| `tokenRevokeFailed`  | `{ token, tokenTypeHint }`              | A token revocation attempt failed                                         |

```vue
<script setup lang="ts">
const { subscribeToEvent } = useStrivacity();

const sub = subscribeToEvent('tokenRefreshed', ({ accessToken }) => {
	console.log('Token refreshed:', accessToken);
});

onUnmounted(() => sub.dispose());
</script>
```

---

## Back-channel logout

When `serverSideSession: true`, `POST /auth/backchannel-logout` accepts [OIDC back-channel logout](https://openid.net/specs/openid-connect-backchannel-1_0.html) notifications from your Strivacity tenant (configure the destination as `https://your-app.example.com/auth/backchannel-logout`). The SDK verifies the `logout_token` JWT and, if your storage implements an optional `deleteByLogoutToken({ sid?, sub? })` method, calls it to delete the matching session(s) - the built-in encrypted cookie storage does not implement this (cookies can't be looked up by `sid`/`sub` server-initiated), so back-channel logout requires a custom, lookup-capable storage (e.g. Redis) via `storageFactoryPath`.

---

## Configuration reference

| Option                    | Type                                              | Required                          | Default             | Description                                                                                                                                                        |
| ------------------------- | ------------------------------------------------- | --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`                    | `'redirect' \| 'popup' \| 'embedded' \| 'native'` | Yes                               | -                   | Authentication flow mode                                                                                                                                           |
| `issuer`                  | `string`                                          | Yes                               | -                   | OIDC issuer URL of your Strivacity tenant                                                                                                                          |
| `clientId`                | `string`                                          | Yes                               | -                   | OAuth2 public client ID                                                                                                                                            |
| `redirectUri`             | `string`                                          | Yes                               | -                   | OAuth2 redirect URI (must match your application configuration; typically `<origin>/auth/callback`)                                                                |
| `scopes`                  | `string[]`                                        | No                                | `['openid']`        | Requested OIDC scopes                                                                                                                                              |
| `storageTokenName`        | `string`                                          | No                                | `'sty.session'`     | Key/cookie name under which the session is stored                                                                                                                  |
| `serverSideSession`       | `boolean`                                         | No                                | `true`              | Store the session server-side in an encrypted cookie instead of the browser; see [Client-side vs server-managed sessions](#client-side-vs-server-managed-sessions) |
| `loginUri`                | `string`                                          | No                                | `'/login'`          | URI of the app's login page; used in `embedded`/`native` modes to redirect when a new login is required                                                            |
| `autoRefresh`             | `boolean`                                         | No                                | `true`              | Automatically refreshes the access token before it expires                                                                                                         |
| `lazyLoad`                | `boolean`                                         | No                                | `false`             | When `true`, defers initialization until the first method call                                                                                                     |
| `authUrlPrefix`           | `string`                                          | No                                | `'/auth'`           | URL prefix under which all [server routes](#server-api) are registered                                                                                             |
| `postLoginRedirectUri`    | `string`                                          | No                                | current origin      | Where `/auth/callback` redirects to after a successful login (unless a `returnTo` cookie is present)                                                               |
| `postLogoutRedirectUri`   | `string`                                          | No                                | current origin      | Where `/auth/logout` redirects to after logout                                                                                                                     |
| `secret`                  | `string`                                          | Only if `serverSideSession: true` | -                   | Encryption secret for the built-in cookie session storage                                                                                                          |
| `cookieMaxAge`            | `number`                                          | No                                | `2592000` (30 days) | Max age (seconds) of the session cookie when using the built-in storage                                                                                            |
| `storageFactoryPath`      | `string`                                          | No                                | -                   | Path to a module default-exporting a custom server session storage factory                                                                                         |
| `stateStorageFactoryPath` | `string`                                          | No                                | -                   | Path to a module default-exporting a custom server PKCE/state storage factory                                                                                      |
| `loggingFactoryPath`      | `string`                                          | No                                | -                   | Path to a module default-exporting a custom `SDKLogging` factory                                                                                                   |
| `httpClientFactoryPath`   | `string`                                          | No                                | -                   | Path to a module default-exporting a custom `SDKHttpClient` factory                                                                                                |

For the full list of shared options see [`@strivacity/sdk-core` — Configuration reference](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core#configuration-reference).

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
