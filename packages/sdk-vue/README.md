# @strivacity/sdk-vue

Vue 3 SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Vue application.

> See the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/vue) for a complete, working reference implementation covering all four login modes.

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Quick start](#quick-start)
- [Login flows](#login-flows)
  - [redirect](#redirect-mode)
  - [popup](#popup-mode)
  - [embedded](#embedded-mode)
  - [native](#native-mode)
  - [Custom login session URI](#custom-login-session-uri)
- [Composables API](#composables-api)
- [Session storages](#session-storages)
- [SDK events](#sdk-events)
- [My Account API](#my-account-api)
- [Configuration reference](#configuration-reference)

---

## Prerequisites

- Vue 3
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-vue
```

---

## Choosing a mode

| Mode       | Login UI                                 | Best for                                     |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `redirect` | Strivacity hosted page                   | Standard web apps                            |
| `popup`    | Strivacity hosted page in a popup        | SPAs that must stay on the current page      |
| `embedded` | Strivacity web components in your page   | Branded login inside your own layout         |
| `native`   | Your own components driven by flow state | Full UI control, step-by-step form rendering |

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where the login UI lives and how the flow state is consumed.

---

## Quick start

### 1. Install the plugin

`createStrivacitySDK` returns a Vue [plugin](https://vuejs.org/guide/reusability/plugins.html) - install it once on the root app instance. It initializes the SDK and provides the auth context to every component in the tree via `provide`/`inject`, so no wrapper component is needed.

```ts
// main.ts
import { createApp } from 'vue';
import { createStrivacitySDK, createDefaultLogging } from '@strivacity/sdk-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
	createStrivacitySDK({
		mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native'
		issuer: 'https://YOUR_TENANT.strivacity.com',
		clientId: 'YOUR_CLIENT_ID',
		redirectUri: 'https://your-app.example.com/callback',
		scopes: ['openid', 'profile', 'email'],
		logging: createDefaultLogging(),
	}),
);

app.mount('#app');
```

### 2. Use the auth state

Call `useStrivacity()` in any component to read the current authentication state and trigger login or logout.

```vue
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';

const { loading, isAuthenticated, idTokenClaims, login, logout } = useStrivacity();
</script>

<template>
	<div v-if="!loading">
		<template v-if="isAuthenticated">
			<span>Hello, {{ idTokenClaims?.given_name }}</span>
			<button @click="logout()">Log out</button>
		</template>
		<button v-else @click="login()">Log in</button>
	</div>
</template>
```

### 3. Guard authenticated routes (Vue Router)

There is no built-in route guard component - use `useStrivacity()` inside a [navigation guard](https://router.vuejs.org/guide/advanced/navigation-guards.html):

```ts
// router.ts
import type { NavigationGuardWithThis } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const requireAuth: NavigationGuardWithThis<undefined> = async (_to, _from, next) => {
	const { sdk, isAuthenticated } = useStrivacity();

	await sdk.init();

	if (!isAuthenticated.value) {
		next(sdk.options.loginUri);
	} else {
		next();
	}
};
```

```ts
router.addRoute({ path: '/profile', component: Profile, beforeEnter: requireAuth });
```

---

## Login flows

### redirect mode

The user is redirected to the Strivacity-hosted login page and back after authentication.

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useStrivacity } from '@strivacity/sdk-vue';

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

Call this on your redirect URI page after the IDP sends the user back.

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const { handleCallback } = useStrivacity();
const router = useRouter();

onMounted(async () => {
	try {
		await handleCallback();
		await router.push('/profile');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>
```

### popup mode

The Strivacity login page opens in a separate window. After the user authenticates the popup closes and the parent page receives the session automatically - no callback page needed.

Configuration is the same as `redirect` - just set `mode: 'popup'`. `login()` opens the popup automatically; pass `popupWindowTarget`/`popupWindowFeatures` to control its size and position.

### embedded mode

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`) - `sty-notifications` shows toast-style system notifications and `sty-language-selector` lets the user switch the login flow's language. Load the components bundle with `injectScript`, then mount the elements. Use Vue's `.` property-binding modifier for the `params` object (plain objects can't be represented as HTML attributes):

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { injectScript } from '@strivacity/sdk-vue';

const issuer = import.meta.env.VITE_ISSUER;
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
import type { LoginComponent } from '@strivacity/sdk-vue';
import { useTemplateRef } from 'vue';

const loginEl = useTemplateRef<LoginComponent>('loginEl');

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

For flows started externally (e.g. a password reset email link), call `entry()` on the landing page. It resolves the flow parameters from the IDP (`session_id`, `short_app_id`, `language`) - pass them directly to the `sty-login` element on the same page.

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useStrivacity } from '@strivacity/sdk-vue';

const { entry } = useStrivacity();
const data = ref<Record<string, string>>();

onMounted(async () => {
	data.value = await entry();
});
</script>

<template>
	<sty-login v-if="data" :sessionId="data.session_id" :shortAppId="data.short_app_id" :lang="data.language"></sty-login>
</template>
```

### native mode

You build the entire login UI with your own components using the `useNativeLogin` composable. It drives the flow state and returns a `LoginContext`: `loading`, `forms` (current field values), `messages` (validation/info messages), `state` (the current `LoginFlowState` - `screen`, `forms` widget definitions, `layout`, `finalizeUrl`, ...), `submitForm`, `setFormValue`, `setMessage`, `triggerFallback`, `triggerClose`.

`useNativeLogin` also `provide()`s the context under the `STRIVACITY_LOGIN_CONTEXT` key, so any descendant component can read it with `useNativeLoginContext()` without prop drilling.

> The SDK does **not** ship ready-made widget components or a renderer for native mode - it only provides the state machine. Build your own widget components (or copy the ones from the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/vue/src/components/login)) that read/write state via `useNativeLoginContext()`, and a `WidgetRenderer` that walks `state.layout.items` (each item is either `{ type: 'widget', formId, widgetId }`, resolved by looking it up in `state.forms`, or a nested `{ type: 'vertical' | 'horizontal', items: [...] }` group) to decide what to render and in what order.

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useNativeLogin } from '@strivacity/sdk-vue';
import { WidgetRenderer, widgets } from '../components/login';

const router = useRouter();

const ctx = useNativeLogin({
	params: {
		// Optional parameters
		loginHint: 'user@example.com',
		acrValues: ['urn:strivacity:loa:2'],
		audiences: ['https://api.example.com'],
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

Same as for embedded mode: call `sdk.entry()` (or read the query params from an `/entry`-style landing page) to resolve `session_id`/`short_app_id`/`language`, then pass them via `params` to `useNativeLogin`.

---

### Custom login session URI

All four modes accept an optional `loginSessionUri` parameter to start the flow through your own server-side endpoint (e.g. a BFF) instead of the SDK's default IDP endpoint - useful when the request must be built/signed server-side. Sensitive OAuth2 parameters (`client_id`, `redirect_uri`, `scope`, PKCE, ...) are never sent to `loginSessionUri` - your endpoint is responsible for adding those itself; only the non-sensitive extras (`prompt`, `display`, `acrValues`, `loginHint`, `uiLocales`, `audiences`) are appended as query params.

Pass it to `login()`/`register()` (`redirect`/`popup`) or as part of `params` to `useNativeLogin()` (`native`):

```vue
<script setup lang="ts">
import { useStrivacity, useNativeLogin } from '@strivacity/sdk-vue';

const { login } = useStrivacity();

// redirect / popup
await login({ loginSessionUri: '/api/auth/login' });

// native
useNativeLogin({ params: { loginSessionUri: '/api/auth/login/session' } });
</script>
```

> In `native` mode the SDK calls `loginSessionUri` through `sdk.httpClient` (instead of navigating the browser) to resolve the session parameters.

`embedded` mode supports the same parameter directly on the `<sty-login>` element - pass it via the `params` prop instead of letting it build the default IDP request:

```vue
<template>
	<sty-login :params.prop="{ loginSessionUri: '/api/auth/login/session' }"></sty-login>
</template>
```

---

## Composables API

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

---

## Session storages

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

```ts
import { createStrivacitySDK, createCookieStorage } from '@strivacity/sdk-vue';

app.use(
	createStrivacitySDK({
		// ...
		storage: createCookieStorage({ maxAge: 2592000, sameSite: 'Lax' }),
	}),
);
```

---

## SDK events

Subscribe to authentication lifecycle events via `subscribeToEvent` (one specific event) or `subscribeToAllEvents` (all events). Both return a `{ dispose() }` handle.

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

```ts
const { subscribeToEvent } = useStrivacity();

const sub = subscribeToEvent('tokenRefreshed', ({ accessToken }) => {
	console.log('Token refreshed:', accessToken);
});

sub.dispose();
```

---

## My Account API

The My Account API lets authenticated users manage their own profile, identifiers, authenticators, and account data. There is no Vue-specific wrapper - call the `@strivacity/sdk-core/utils/myaccount` functions directly with the access token and SDK options from `useStrivacity()`:

```ts
import * as myAccount from '@strivacity/sdk-core/utils/myaccount';
import { useStrivacity } from '@strivacity/sdk-vue';

const { sdk } = useStrivacity();
const token = await sdk.getAccessToken();
const options = sdk.options;

const { attributes, data } = await myAccount.fetchAccountData({ token, options });
```

For the full method list see [`@strivacity/sdk-core` — My Account API](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core#my-account-api).

---

## Configuration reference

| Option              | Type                                              | Required | Default         | Description                                                                                             |
| ------------------- | ------------------------------------------------- | -------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `mode`              | `'redirect' \| 'popup' \| 'embedded' \| 'native'` | Yes      | -               | Authentication flow mode                                                                                |
| `issuer`            | `string`                                          | Yes      | -               | OIDC issuer URL of your Strivacity tenant                                                               |
| `clientId`          | `string`                                          | Yes      | -               | OAuth2 public client ID                                                                                 |
| `redirectUri`       | `string`                                          | Yes      | -               | OAuth2 redirect URI (must match your application configuration)                                         |
| `scopes`            | `string[]`                                        | No       | `['openid']`    | Requested OIDC scopes                                                                                   |
| `storage`           | `SDKStorage`                                      | No       | `localStorage`  | Session storage; see [Session storages](#session-storages)                                              |
| `storageTokenName`  | `string`                                          | No       | `'sty.session'` | Key under which the session is stored in the storage                                                    |
| `serverSideSession` | `boolean`                                         | No       | `false`         | Set to `true` when session storage is managed server-side (tokens are not written to client storage)    |
| `loginUri`          | `string`                                          | No       | `'/login'`      | URI of the app's login page; used in `embedded`/`native` modes to redirect when a new login is required |
| `autoRefresh`       | `boolean`                                         | No       | `true`          | Automatically refreshes the access token before it expires                                              |
| `lazyLoad`          | `boolean`                                         | No       | `false`         | When `true`, defers initialization until the first method call                                          |
| `logging`           | `SDKLogging`                                      | No       | -               | Logging adapter                                                                                         |
| `httpClient`        | `SDKHttpClient`                                   | No       | fetch           | Custom HTTP client adapter                                                                              |

For the full list of shared options see [`@strivacity/sdk-core` — Configuration reference](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core#configuration-reference).

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
