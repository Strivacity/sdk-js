# @strivacity/sdk-nuxt

Nuxt SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Nuxt application. Ships as a single Nuxt module: a client SDK (auto-imported composables) plus a backend-for-frontend ([BFF](../../README.md#bff)) Server SDK that registers its own Nitro routes and middleware - no separate backend required.

Built on top of [@strivacity/sdk-core](../sdk-core) - see the [core SDK documentation](../sdk-core/README.md) for detailed information about authentication flows, configuration options, and advanced features.

**See also:**
- [Full Documentation](https://docs.strivacity.com/reference/overview) - Complete guide for all authentication modes
- [Example App](../../apps/nuxt) - Working Nuxt example covering both client-managed and server-managed sessions
- [Core SDK](../sdk-core/README.md) - Framework-agnostic SDK documentation

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Client-managed vs. server-managed sessions](#client-managed-vs-server-managed-sessions)
- [Quick start](#quick-start)
- [Client SDK](#client-sdk)
  - [Authentication modes](#authentication-modes)
    - [redirect mode](#redirect-mode)
    - [popup mode](#popup-mode)
    - [embedded mode](#embedded-mode)
    - [native mode](#native-mode)
  - [Composables API](#composables-api)
    - [useStrivacity](#usestrivacity)
    - [useNativeLogin](#usenativelogin)
- [Server SDK](#server-sdk)
  - [Setup](#setup)
  - [Accessing the session server-side](#accessing-the-session-server-side)
  - [Storages](#server-storages)
  - [Back-channel logout](#back-channel-logout)
  - [Server SDK API reference](#server-sdk-api-reference)
  - [Server configuration reference](#server-configuration-reference)
- [Route guards](#route-guards)
- [Shared features](#shared-features)
- [Configuration reference](#configuration-reference)
- [Migration guide](#migration-guide)
- [Vulnerability Reporting](#vulnerability-reporting)
- [License](#license)
- [Contributing](#contributing)

---

## Prerequisites

- Nuxt 4+
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-nuxt
```

---

## Choosing a mode

The SDK supports **four authentication modes**:

| Mode       | Login UI                                 | Best for                                     |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `redirect` | Strivacity hosted page                   | Standard web apps                            |
| `popup`    | Strivacity hosted page in a popup        | SPAs that must stay on the current page      |
| `embedded` | Strivacity web components in your page   | Branded login inside your own layout         |
| `native`   | Your own components driven by flow state | Full UI control, step-by-step form rendering |

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where the login UI lives and how the flow state is consumed.

---

## Client-managed vs. server-managed sessions

The SDK supports two session strategies, selectable per app via a single option:

| Strategy | Tokens live in | Best for |
| -------- | --------------- | -------- |
| **Client-managed** | Browser storage (`localStorage` by default) | Simple SPAs that don't need to hide tokens from the browser |
| **Server-managed (BFF)** | Server-side storage (encrypted http-only cookies by default) via the [Server SDK](#server-sdk) | Apps that need to keep tokens inaccessible to client-side JavaScript, sign requests server-side, or add custom server-side validation |

Set `serverSessionUri` on the shared SDK options to switch the client SDK into server-managed mode - login requests are then routed through your own server endpoint instead of the SDK talking to the IDP directly, and tokens are never read from or written to client-side storage. See [Server-side session management](../sdk-core/README.md#server-side-session-management) in the core SDK docs for how this works under the hood. Both strategies are shown side by side below.

---

## Quick start

### 1. Register the module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],
});
```

### 2. Configure it

Client and server options live together under a single `strivacity` key - the module automatically strips `cookieSecret` and the storage/logging/HTTP-client factory paths before exposing the rest to the client:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		mode: 'redirect', // authentication mode
		issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
		clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
		redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
		scopes: ['openid', 'profile', 'email'], // requested user permissions/data

		serverSessionUri: '/auth/login', // Set to `null` for client-managed sessions - omitting this line still defaults to server-managed
		cookieSecret: process.env.COOKIE_SECRET, // http-only cookie encryption key (random 32+ characters), required for server-managed sessions
		postLoginRedirectUri: '/profile',
	},
});
```

The module automatically:
- registers `/auth/login`, `/auth/register`, `/auth/callback`, `/auth/refresh`, `/auth/revoke`, `/auth/entry`, `/auth/logout`, and `/auth/backchannel-logout` as Nitro server routes (see the table below)
- auto-imports `useStrivacity()`/`useNativeLogin()` on the client and `useStrivacity(event)` on the server - no import statements needed anywhere
- with server-managed sessions, registers a global route middleware that resolves the session server-side before every render, so there's no separate provider component or session-prop wiring to do yourself. When the access token is within `refreshSkew` seconds of expiry and the session has a refresh token, the middleware refreshes it first (with the Server SDK's `getSession()`) and writes the rotated session cookie to the response; if the refresh fails, `useSession()` is `undefined`. Set `autoRefresh: false` in the Server SDK options to turn this off. The refresh token and ID token are removed (with `toClientSession()`) before the session is stored in `useSession()` (and serialized into the rendered HTML) - they stay in the server-side session

| Method | Path                        | Description                                              | Response                                    |
| ------ | --------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `GET`  | `/auth/login`                | Starts the login flow and redirects to the IDP              | `302` redirect to IDP                        |
| `GET`  | `/auth/register`             | Starts the registration flow and redirects to the IDP       | `302` redirect to IDP                        |
| `GET`  | `/auth/callback`             | Completes authentication (handles the IDP callback)          | `302` redirect or popup close script         |
| `GET`  | `/auth/refresh`              | Refreshes the access token                                   | `204 No Content` or `302` redirect           |
| `GET`  | `/auth/revoke`               | Revokes tokens and clears the session                        | `302` redirect to `postLogoutRedirectUri`    |
| `GET`  | `/auth/logout`               | Ends the session and redirects to the IDP logout page; accepts a same-origin `?returnTo=` (default: `postLogoutRedirectUri`) | `302` to IDP logout (straight to `returnTo` when the session has no ID token)                 |
| `GET`  | `/auth/entry`                | Handles external flow entry (e.g., password reset link) - embedded/native modes only | `302` redirect to `loginPageUri` |
| `POST` | `/auth/backchannel-logout`   | Processes back-channel logout requests from the IDP           | `200 OK` (`400` invalid token, `501` storage without `deleteByLogoutToken`, `500` delete failed)   |

> The `/auth` prefix and route names come from `authUriPrefix` - see [Server configuration reference](#server-configuration-reference).

---

## Client SDK

### Authentication modes

#### redirect mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The current browser tab navigates to the Strivacity-hosted login page and back to the configured `redirectUri` after authentication.

##### Login

**Client-managed sessions**:

Call this to start the login flow. It redirects the user to the Strivacity login page in the current browser tab, where they authenticate.

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
import type { RedirectFlow } from '@strivacity/sdk-nuxt';

const { login } = useStrivacity<RedirectFlow>();

onMounted(() => {
	void login({
		// Optional parameters
		loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
		acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
		audiences: ['https://api.example.com'], // target resources for the access token
		resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
	});
});
</script>

<template>
	<section>
		<h1>Redirecting to login...</h1>
	</section>
</template>
```

**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/login` - the Server SDK builds the authorization request and redirects to the IDP. Use `navigateTo` with `external: true` so it's a real HTTP redirect rather than a client-side route match attempt:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
await navigateTo('/auth/login', { external: true });
</script>
```

##### Handle the callback

**Client-managed sessions**:

Call this on your redirect URI route after the IDP sends the user back. It parses the query parameters from the callback URL, verifies the state matches what was stored during login (CSRF protection), exchanges the authorization code for tokens using PKCE, validates the ID token, and stores the session in the [configured storage](../sdk-core/README.md#storages).

```vue
<!-- app/pages/callback.vue -->
<script setup lang="ts">
const router = useRouter();
const { handleCallback } = useStrivacity();
const searchParams = new URLSearchParams(globalThis.window?.location.search);

onMounted(async () => {
	if (searchParams.get('error') || searchParams.get('error_description')) {
		await router.replace(`/error?${searchParams.toString()}`);
		return;
	}

	try {
		await handleCallback();
		await router.push('/profile');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template>
	<section>
		<h1>Logging in...</h1>
	</section>
</template>
```

**Server-managed sessions**:

Forward the callback query string to `/auth/callback` - the Server SDK completes the code exchange and redirects to `postLoginRedirectUri`:

```vue
<!-- app/pages/callback.vue -->
<script setup lang="ts">
const route = useRoute();

await navigateTo({ path: '/auth/callback', query: route.query }, { redirectCode: 302, external: true });
</script>
```

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```vue
<!-- app/pages/register.vue -->
<script setup lang="ts">
import type { RedirectFlow } from '@strivacity/sdk-nuxt';

const { register } = useStrivacity<RedirectFlow>();

onMounted(() => {
	void register({
		loginHint: 'user@example.com',
	});
});
</script>

<template>
	<section>
		<h1>Redirecting to registration...</h1>
	</section>
</template>
```

**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/register` - the Server SDK builds the registration request and redirects to the IDP:

```vue
<!-- app/pages/register.vue -->
<script setup lang="ts">
await navigateTo('/auth/register', { external: true });
</script>
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```vue
<!-- app/pages/logout.vue -->
<script setup lang="ts">
const { logout } = useStrivacity();

onMounted(() => {
	void logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured, the `logout()` call above doesn't clear the server session cookie, so redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint, which then sends the user back to `postLogoutRedirectUri`. To land somewhere else, add a same-origin `?returnTo=` (e.g. `/auth/logout?returnTo=/goodbye`); a missing, invalid, or cross-origin value falls back to `postLogoutRedirectUri`. Whichever URL is used must be registered as an allowed post-logout redirect URI:

```vue
<!-- app/pages/logout.vue -->
<script setup lang="ts">
await navigateTo('/auth/logout', { external: true });
</script>
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```vue
<script setup lang="ts">
const { loading, idTokenClaims, accessToken, refreshToken, refresh, revoke } = useStrivacity();

async function onRefresh() {
	// Refresh the access token using the refresh token
	await refresh();
}

async function onRevoke() {
	// Revoke all tokens at the authorization server and clear the local session
	await revoke();
}
</script>

<template>
	<!-- idTokenClaims/accessToken/refreshToken are refs - Vue unwraps them automatically in templates -->
	<div v-if="!loading">
		<button @click="onRefresh">Refresh</button>
		<button @click="onRevoke">Revoke</button>
		<pre>{{ JSON.stringify({ idTokenClaims, accessToken, refreshToken }, null, 2) }}</pre>
	</div>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let it redirect back. `sdk.refresh({ returnTo: '/profile' })` (`sdk` from `useStrivacity()`) performs the same refresh navigation for you:

```vue
<script setup lang="ts">
function onRefresh() {
	// sdk.refreshSession() runs server-side, then redirects back to returnTo
	globalThis.location.href = '/auth/refresh?returnTo=/profile';
}

function onRevoke() {
	// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
	globalThis.location.href = '/auth/revoke';
}
</script>

<template>
	<div>
		<button @click="onRefresh">Refresh</button>
		<button @click="onRevoke">Revoke</button>
	</div>
</template>
```

---

#### popup mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The Strivacity login page opens in a separate window or tab. After authentication the opened window or tab closes itself and the parent page receives the session - no full-page navigation required.

##### Login

**Client-managed sessions**:

Call this to start the login flow. It opens a popup window by default with the Strivacity login page, where the user authenticates. After that the popup closes itself and the session is stored in the [configured storage](../sdk-core/README.md#storages).

By default a centered popup window opens. Pass `popupWindowTarget` to change where the window opens, and `popupWindowFeatures` to control its size and position:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
import type { PopupFlow } from '@strivacity/sdk-nuxt';

const router = useRouter();
const { login } = useStrivacity<PopupFlow>();

onMounted(async () => {
	try {
		await login({
			// Optional parameters
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
			popupWindowTarget: '_blank', // any valid browsing context name
			popupWindowFeatures: {
				width: 500,
				height: 700,
				left: 100,
				top: 100,
				toolbar: false,
				location: false,
				resizable: true,
				scrollbars: true,
			},
		});

		await router.push('/profile');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template>
	<section>
		<h1>Opening login popup...</h1>
	</section>
</template>
```

**Server-managed sessions**:

Popup mode always needs client-side JavaScript to open the window, so there's no server-only alternative here.

##### Handle the callback

**Client-managed sessions**:

The pop-up still navigates to your `redirectUri`, so you still need a callback route there - without it nothing posts the result back to the opener. Call `handleCallback()` there; in popup mode it never resolves (the opener closes the pop-up once it receives the result), so don't rely on code after it running:

```vue
<!-- app/pages/callback.vue -->
<script setup lang="ts">
const { handleCallback } = useStrivacity();

onMounted(() => {
	void handleCallback();
});
</script>

<template>
	<section>
		<h1>Logging in...</h1>
	</section>
</template>
```

`login()` resolves in the opener once the result has been received and, for client-managed sessions, the tokens have been exchanged.

**Server-managed sessions**:

The callback page must not call `handleCallback()`: forward the query string to `/auth/callback` instead, as in the server-managed redirect callback. The Server SDK exchanges the code, sets the session cookie and responds with a page that posts the result to the opener and closes the pop-up.

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```vue
<!-- app/pages/register.vue -->
<script setup lang="ts">
import type { PopupFlow } from '@strivacity/sdk-nuxt';

const router = useRouter();
const { register } = useStrivacity<PopupFlow>();

onMounted(async () => {
	try {
		await register({
			// Optional parameters
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
			popupWindowTarget: '_blank', // any valid browsing context name
			popupWindowFeatures: {
				width: 500,
				height: 700,
				left: 100,
				top: 100,
				toolbar: false,
				location: false,
				resizable: true,
				scrollbars: true,
			},
		});
		await router.push('/profile');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template>
	<section>
		<h1>Opening registration popup...</h1>
	</section>
</template>
```

**Server-managed sessions**:

Popup mode always needs client-side JavaScript to open the window, so there's no server-only alternative here.

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```vue
<!-- app/pages/logout.vue -->
<script setup lang="ts">
const { logout } = useStrivacity();

onMounted(() => {
	void logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured, the `logout()` call above doesn't clear the server session cookie, so redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint, which then sends the user back to `postLogoutRedirectUri`. To land somewhere else, add a same-origin `?returnTo=` (e.g. `/auth/logout?returnTo=/goodbye`); a missing, invalid, or cross-origin value falls back to `postLogoutRedirectUri`. Whichever URL is used must be registered as an allowed post-logout redirect URI:

```vue
<!-- app/pages/logout.vue -->
<script setup lang="ts">
await navigateTo('/auth/logout', { external: true });
</script>
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```vue
<script setup lang="ts">
const { loading, idTokenClaims, accessToken, refreshToken, refresh, revoke } = useStrivacity();

async function onRefresh() {
	// Refresh the access token using the refresh token
	await refresh();
}

async function onRevoke() {
	// Revoke all tokens at the authorization server and clear the local session
	await revoke();
}
</script>

<template>
	<div v-if="!loading">
		<button @click="onRefresh">Refresh</button>
		<button @click="onRevoke">Revoke</button>
		<pre>{{ JSON.stringify({ idTokenClaims, accessToken, refreshToken }, null, 2) }}</pre>
	</div>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let it redirect back. `sdk.refresh({ returnTo: '/profile' })` (`sdk` from `useStrivacity()`) performs the same refresh navigation for you:

```vue
<script setup lang="ts">
function onRefresh() {
	// sdk.refreshSession() runs server-side, then redirects back to returnTo
	globalThis.location.href = '/auth/refresh?returnTo=/profile';
}

function onRevoke() {
	// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
	globalThis.location.href = '/auth/revoke';
}
</script>

<template>
	<div>
		<button @click="onRefresh">Refresh</button>
		<button @click="onRevoke">Revoke</button>
	</div>
</template>
```

---

#### embedded mode

> For details on how this mode works, see the [embedded journey documentation](https://docs.strivacity.com/reference/embedded-journey).

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your Strivacity tenant cluster once, on the login route:

##### Login / Register

**Client-managed sessions**:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
const { sdk } = useStrivacity();
const searchParams = new URLSearchParams(globalThis.window?.location.search);

const params = {
	loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
	acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
	audiences: ['https://api.example.com'], // target resources for the access token
	resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
	language: 'en-US', // set the UI language (BCP 47 language tag)
	prompt: 'login', // use 'create' to open the registration flow instead
};
// Optional: Resume a session started from an entry URL (e.g., password reset)
const sessionId = ref(searchParams.get('session_id'));
const shortAppId = ref(searchParams.get('short_app_id'));
const language = ref(searchParams.get('language') ?? globalThis.navigator?.language);

// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
// custom element definitions from the auth server
injectScript('sty-components', `${sdk.options.issuer}/assets/components/bundle.js`);

function onLogin() {
	globalThis.location.href = '/profile';
}

function onClose() {
	globalThis.location.reload();
}

function onError(errorOrEvent: Error | CustomEvent<string>) {
	const message = errorOrEvent instanceof Error ? errorOrEvent.message : errorOrEvent.detail;
	globalThis.location.href = `/error?message=${encodeURIComponent(message)}`;
}
</script>

<template>
	<section>
		<sty-notifications></sty-notifications>
		<sty-login
			:params.prop="params"
			:sessionId="sessionId"
			:shortAppId="shortAppId"
			:lang="language"
			@login="onLogin"
			@close="onClose"
			@error="onError"
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - the `<sty-login>` component's internal requests are transparently proxied through `/auth/login`/`/auth/register` instead of going straight to the IDP.

##### Controlling when the flow starts

By default the login flow starts automatically as soon as `<sty-login>` connects to the DOM. Add the `lazy` attribute to take manual control, then call `start()` when ready. `start()` accepts an optional params object forwarded to the authorization request, or you can set params via the `params` property before calling it:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
import type { LoginComponent } from '@strivacity/sdk-nuxt';

const router = useRouter();
const loginRef = ref<LoginComponent>();

async function onStartClick() {
	await loginRef.value?.start({
		loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
		acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
		audiences: ['https://api.example.com'], // target resources for the access token
		resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
		language: 'en-US', // set the UI language (BCP 47 language tag)
		prompt: 'login', // use 'create' to open the registration flow instead
	});
}
</script>

<template>
	<section>
		<sty-notifications></sty-notifications>
		<button @click="onStartClick">Continue to login</button>
		<sty-login ref="loginRef" lazy @login="router.push('/profile')"></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
```

You can also set params via the `params` property before calling `start()`:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
import type { LoginComponent } from '@strivacity/sdk-nuxt';

const loginRef = ref<LoginComponent>();

async function onStartClick() {
	if (!loginRef.value) {
		return;
	}

	loginRef.value.params = {
		loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
		acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
		audiences: ['https://api.example.com'], // target resources for the access token
		resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
		language: 'en-US', // set the UI language (BCP 47 language tag)
		prompt: 'login', // use 'create' to open the registration flow instead
	};
	await loginRef.value.start();
}
</script>

<template>
	<sty-login ref="loginRef" lazy></sty-login>
	<button @click="onStartClick">Start Login</button>
</template>
```

##### Login events

The `<sty-login>` element dispatches `login`, `close`, and `error` custom events. Listen to them using Vue's `@` directive:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
const router = useRouter();

async function onLogin() {
	// User authenticated - navigate to a protected page
	await router.push('/profile');
}

function onClose() {
	// User cancelled or closed the login flow
	globalThis.location.reload();
}

async function onError(event: CustomEvent) {
	// A fatal error occurred - the message is available in event.detail
	await router.push(`/error?message=${encodeURIComponent(event.detail)}`);
}
</script>

<template>
	<section>
		<sty-notifications></sty-notifications>
		<sty-login
			@login="onLogin"
			@close="onClose"
			@error="onError"
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
```

##### Notification events

The components dispatch `notification` events on the `document` that the `<sty-notifications>` component automatically displays. If you don't want to use `<sty-notifications>`, you can listen to these events and handle them yourself:

```vue
<script setup lang="ts">
function onNotification(event: Event) {
	const customEvent = event as CustomEvent;

	if (customEvent.detail.action === 'show') {
		// Add new notification to your custom notification system
		console.log('New notification:', customEvent.detail.notification);
	} else if (customEvent.detail.action === 'clear') {
		console.log('Clear all notifications');
	}
}

onMounted(() => {
	document.addEventListener('notification', onNotification);
});

onUnmounted(() => {
	document.removeEventListener('notification', onNotification);
});
</script>
```

##### Dynamic language switching

The `<sty-language-selector>` component provides a built-in UI for language switching. If you don't want to use it, you can change the UI language dynamically by updating the `lang` property on the `<sty-login>` component:

```vue
<script setup lang="ts">
const loginEl = useTemplateRef<HTMLElement & { lang: string }>('loginEl');
const currentLang = ref('en-US');

function changeLanguage(lang: string) {
	currentLang.value = lang;

	if (loginEl.value) {
		loginEl.value.lang = lang;
	}
}
</script>

<template>
	<section>
		<div>
			<button @click="changeLanguage('en-US')">English</button>
			<button @click="changeLanguage('fr-FR')">Français</button>
			<button @click="changeLanguage('de-DE')">Deutsch</button>
		</div>
		<sty-login ref="loginEl" :lang="currentLang"></sty-login>
	</section>
</template>
```

##### Handle the callback

**Client-managed sessions**:

No separate callback route is needed. The `<sty-login>` component handles the entire authentication flow automatically, including token exchange, and dispatches a `login` event when authentication completes successfully.

**Server-managed sessions**:

Same as client managed - the component's internal callback request is also transparently proxied through `/auth/callback`, with no separate route needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing route to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login route**

Forward the parameters as query params to your login route:

```vue
<!-- app/pages/entry.vue -->
<script setup lang="ts">
import type { EmbeddedFlow } from '@strivacity/sdk-nuxt';

const { entry } = useStrivacity<EmbeddedFlow>();
const router = useRouter();

onMounted(async () => {
	try {
		const data = await entry();

		// Redirect to login route with flow parameters
		const params = new URLSearchParams({
			session_id: data.session_id,
			short_app_id: data.short_app_id,
			language: data.language,
		});
		globalThis.location.href = `/login?${params}`;
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template>
	<section>
		<h1>Loading...</h1>
	</section>
</template>
```

Then on your login route, read the parameters and pass them to `<sty-login>`:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
const router = useRouter();
const searchParams = new URLSearchParams(globalThis.window?.location.search);

// Read parameters from URL
const sessionId = searchParams.get('session_id');
const shortAppId = searchParams.get('short_app_id');
const language = searchParams.get('language');

async function onLogin() {
	// User authenticated - navigate to a protected page
	await router.push('/profile');
}

async function onError(event: CustomEvent) {
	await router.push(`/error?message=${encodeURIComponent(event.detail)}`);
}
</script>

<template>
	<section>
		<sty-notifications></sty-notifications>
		<sty-login
			:sessionId="sessionId"
			:shortAppId="shortAppId"
			:lang="language"
			@login="onLogin"
			@error="onError"
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
```

**Option 2: Render login on the entry route**

Pass the parameters directly to `<sty-login>` on the same route:

```vue
<!-- app/pages/entry.vue -->
<script setup lang="ts">
import type { EmbeddedFlow } from '@strivacity/sdk-nuxt';

const { entry } = useStrivacity<EmbeddedFlow>();
const router = useRouter();

const sessionId = ref<string | null>(null);
const shortAppId = ref<string | null>(null);
const language = ref<string | null>(null);

onMounted(async () => {
	try {
		const data = await entry();

		// Set properties for sty-login component
		sessionId.value = data.session_id;
		shortAppId.value = data.short_app_id;
		language.value = data.language;
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});

async function onLogin() {
	// User authenticated - navigate to a protected page
	await router.push('/profile');
}

async function onError(event: CustomEvent) {
	await router.push(`/error?message=${encodeURIComponent(event.detail)}`);
}
</script>

<template>
	<section v-if="sessionId">
		<sty-notifications></sty-notifications>
		<sty-login
			:sessionId="sessionId"
			:shortAppId="shortAppId"
			:lang="language"
			@login="onLogin"
			@error="onError"
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
	<section v-else>
		<h1>Loading...</h1>
	</section>
</template>
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```vue
<!-- app/pages/logout.vue -->
<script setup lang="ts">
const { logout } = useStrivacity();

onMounted(() => {
	void logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured, the `logout()` call above doesn't clear the server session cookie, so redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint, which then sends the user back to `postLogoutRedirectUri`. To land somewhere else, add a same-origin `?returnTo=` (e.g. `/auth/logout?returnTo=/goodbye`); a missing, invalid, or cross-origin value falls back to `postLogoutRedirectUri`. Whichever URL is used must be registered as an allowed post-logout redirect URI:

```vue
<!-- app/pages/logout.vue -->
<script setup lang="ts">
await navigateTo('/auth/logout', { external: true });
</script>
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```vue
<script setup lang="ts">
const { loading, idTokenClaims, accessToken, refreshToken, refresh, revoke } = useStrivacity();

async function onRefresh() {
	// Refresh the access token using the refresh token
	await refresh();
}

async function onRevoke() {
	// Revoke all tokens at the authorization server and clear the local session
	await revoke();
}
</script>

<template>
	<div v-if="!loading">
		<button @click="onRefresh">Refresh</button>
		<button @click="onRevoke">Revoke</button>
		<pre>{{ JSON.stringify({ idTokenClaims, accessToken, refreshToken }, null, 2) }}</pre>
	</div>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let it redirect back. `sdk.refresh({ returnTo: '/profile' })` (`sdk` from `useStrivacity()`) performs the same refresh navigation for you:

```vue
<script setup lang="ts">
function onRefresh() {
	// sdk.refreshSession() runs server-side, then redirects back to returnTo
	globalThis.location.href = '/auth/refresh?returnTo=/profile';
}

function onRevoke() {
	// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
	globalThis.location.href = '/auth/revoke';
}
</script>

<template>
	<div>
		<button @click="onRefresh">Refresh</button>
		<button @click="onRevoke">Revoke</button>
	</div>
</template>
```

---

#### native mode

> For details on how this mode works, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey).

You build the entire login UI with your own components. `useNativeLogin()` drives a "headless" auth flow: instead of redirecting to a hosted page, the SDK returns a JSON description of the current screen that you render yourself, submit each form step with `submitForm()`, and repeat until the flow finalizes automatically.

> If you split widget rendering into separate sub-components, they'll need access to the login context returned by `useNativeLogin()` - see [useNativeLogin](#usenativelogin) below.
>
> The example below shows a simplified custom implementation. For a complete native renderer with all widget types, see the [example app](../../apps/nuxt/app/components/auth/native/NativeLogin.vue).

##### Login / Register

**Client-managed sessions**:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
const router = useRouter();
const searchParams = new URLSearchParams(globalThis.window?.location.search);

const { state, forms, messages, loading, submitForm, setFormValue } = useNativeLogin({
	params: {
		prompt: 'login', // use 'create' to open the registration flow instead
		language: 'en-US', // set the UI language (BCP 47 language tag)
		sessionId: searchParams.get('session_id'), // pass a session ID to resume an existing flow
	},
	onLogin: async () => {
		await router.push('/profile');
	},
	onClose: () => {
		globalThis.location.reload();
	},
	onError: async (error) => {
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
	},
	onFallback: (error) => {
		// Fallback to hosted journey if native widget not supported
		globalThis.location.href = error.url.toString();
	},
	onGlobalMessage: (message) => {
		alert(message.text);
	},
});
</script>

<template>
	<section v-if="loading">
		<h1>Loading...</h1>
	</section>

	<section v-else-if="state.screen === 'identifier'">
		<h2>Sign In</h2>
		<form @submit.prevent="submitForm('identifier')">
			<input
				:value="forms['identifier']?.identifier ?? ''"
				type="text"
				placeholder="Email"
				@input="setFormValue('identifier', 'identifier', ($event.target as HTMLInputElement).value)"
			/>
			<div v-if="messages['identifier']?.identifier" class="error">
				{{ messages['identifier'].identifier.text }}
			</div>
			<button type="submit">Continue</button>
		</form>
	</section>

	<section v-else-if="state.screen === 'password'">
		<h2>Enter Password</h2>
		<form @submit.prevent="submitForm('password')">
			<input
				:value="forms['password']?.password ?? ''"
				type="password"
				placeholder="Password"
				@input="setFormValue('password', 'password', ($event.target as HTMLInputElement).value)"
			/>
			<div v-if="messages['password']?.password" class="error">
				{{ messages['password'].password.text }}
			</div>
			<button type="submit">Sign In</button>
		</form>
	</section>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - `useNativeLogin`'s internal requests are transparently proxied through your server instead of going straight to the IDP.

##### Handle the callback

**Client-managed sessions**:

No separate callback route is needed. Once `state.finalizeUrl` is set, `submitForm()` automatically finalizes the session internally to exchange the authorization code for tokens and store it.

**Server-managed sessions**:

Same as client managed - finalizing the session also transparently proxies through your server, with no separate route needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing route to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login route**

```vue
<!-- app/pages/entry.vue -->
<script setup lang="ts">
import type { NativeFlow } from '@strivacity/sdk-nuxt';

const { entry } = useStrivacity<NativeFlow>();
const router = useRouter();

onMounted(async () => {
	try {
		const data = await entry();

		const params = new URLSearchParams({
			session_id: data.session_id,
			short_app_id: data.short_app_id,
			language: data.language,
		});
		globalThis.location.href = `/login?${params}`;
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template>
	<section>
		<h1>Loading...</h1>
	</section>
</template>
```

Then on your login route, read query parameters from the URL and pass it to `useNativeLogin` to resume the flow, exactly as shown in the Login / Register example above:

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
const searchParams = new URLSearchParams(globalThis.window?.location.search);

const { state, forms, messages, loading, submitForm, setFormValue } = useNativeLogin({
	params: {
		sessionId: searchParams.get('session_id'),
		language: searchParams.get('language'),
	},
	onLogin: async () => {
		globalThis.location.href = '/profile';
	},
});

// ...render based on `state.screen` as shown in the Login / Register example above
</script>
```

**Option 2: Render login on the entry route**

Call `useNativeLogin` directly inside `app/pages/entry.vue`, feeding it the `session_id` resolved from `entry()` - no redirect needed:

```vue
<!-- app/pages/entry.vue -->
<script setup lang="ts">
import type { NativeFlow } from '@strivacity/sdk-nuxt';

const router = useRouter();
const { loading: sdkLoading, entry } = useStrivacity<NativeFlow>();
const sessionId = ref<string | null>(null);
const language = ref<string | null>(null);
const ready = ref(false);

onMounted(async () => {
	try {
		const data = await entry();

		sessionId.value = data.session_id;
		language.value = data.language;
		ready.value = true;
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});

const { state, forms, messages, loading, submitForm, setFormValue } = useNativeLogin({
	params: { sessionId: sessionId.value ?? undefined, language: language.value ?? undefined },
	onLogin: async () => {
		await router.push('/profile');
	},
	onError: async (error) => {
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
	},
});
</script>

<template>
	<section v-if="!ready || sdkLoading || loading">
		<h1>Loading...</h1>
	</section>
	<!-- ...render based on `state.screen` as shown in the Login / Register example above -->
</template>
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```vue
<!-- app/pages/logout.vue -->
<script setup lang="ts">
const { logout } = useStrivacity();

onMounted(() => {
	void logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured, the `logout()` call above doesn't clear the server session cookie, so redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint, which then sends the user back to `postLogoutRedirectUri`. To land somewhere else, add a same-origin `?returnTo=` (e.g. `/auth/logout?returnTo=/goodbye`); a missing, invalid, or cross-origin value falls back to `postLogoutRedirectUri`. Whichever URL is used must be registered as an allowed post-logout redirect URI:

```vue
<!-- app/pages/logout.vue -->
<script setup lang="ts">
await navigateTo('/auth/logout', { external: true });
</script>
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```vue
<script setup lang="ts">
const { loading, idTokenClaims, accessToken, refreshToken, refresh, revoke } = useStrivacity();

async function onRefresh() {
	// Refresh the access token using the refresh token
	await refresh();
}

async function onRevoke() {
	// Revoke all tokens at the authorization server and clear the local session
	await revoke();
}
</script>

<template>
	<div v-if="!loading">
		<button @click="onRefresh">Refresh</button>
		<button @click="onRevoke">Revoke</button>
		<pre>{{ JSON.stringify({ idTokenClaims, accessToken, refreshToken }, null, 2) }}</pre>
	</div>
</template>
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let it redirect back. `sdk.refresh({ returnTo: '/profile' })` (`sdk` from `useStrivacity()`) performs the same refresh navigation for you:

```vue
<script setup lang="ts">
function onRefresh() {
	// sdk.refreshSession() runs server-side, then redirects back to returnTo
	globalThis.location.href = '/auth/refresh?returnTo=/profile';
}

function onRevoke() {
	// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
	globalThis.location.href = '/auth/revoke';
}
</script>

<template>
	<div>
		<button @click="onRefresh">Refresh</button>
		<button @click="onRevoke">Revoke</button>
	</div>
</template>
```

---

### Composables API

All composables below are auto-imported by the module - no import statement is needed in your `.vue` files.

#### useStrivacity

The main composable for accessing the SDK instance and reactive session state.

```ts
import type { RedirectFlow } from '@strivacity/sdk-nuxt';

const ctx = useStrivacity<RedirectFlow>();
```

##### Returns

```ts
{
	// SDK instance (access any SDK method)
	readonly sdk: RedirectFlow | PopupFlow | EmbeddedFlow | NativeFlow;

	// Reactive state
	loading: Ref<boolean>; // True during initialization
	language: Ref<string>; // Current BCP 47 language code
	isAuthenticated: Ref<boolean>; // True if user has valid session
	idTokenClaims: Ref<IdTokenClaims | null>; // Decoded ID token claims
	accessToken: Ref<string | null>; // Current access token
	refreshToken: Ref<string | null>; // Current refresh token
	accessTokenExpired: Ref<boolean>; // True once the access token has expired
	accessTokenExpirationDate: Ref<number | null>; // Access token expiration timestamp

	// Methods (proxied to `sdk`; parameter/return types follow the flow type)
	init(): Promise<void>; // Load metadata and restore any persisted session
	checkAuthentication(params?: { autoRefresh: boolean }): Promise<boolean>; // Check the session, optionally refreshing tokens (never when serverSessionUri is set)
	login(params?: RedirectParams | PopupParams): Promise<void>; // Start login flow (redirect: `returnTo` sets where handleCallback() sends the user) (embedded/native: deprecated, returns a login flow instance - use `sdk.startSession()`)
	register(params?: RedirectParams | PopupParams): Promise<void>; // Start registration flow (same caveat as `login`)
	handleCallback(url?: string | URL): Promise<{ returnTo?: string }>; // Handle OAuth callback; resolves to the `returnTo` given to login()
	logout(params?: LogoutParams): Promise<void>; // End session
	refresh(params?: { returnTo?: string }): Promise<void>; // Refresh access token (server-managed: navigates to the server's refresh route, `${authUriPrefix}/refresh`, instead; `returnTo` sets where it returns, default: the current URL)
	revoke(): Promise<void>; // Revoke tokens
	tokenExchange(params?: Record<string, string>): Promise<void>; // Perform a token exchange
	entry(url?: string | URL): Promise<EntryResponse>; // Handle external entry (embedded/native; resolves `{ session_id, short_app_id, language }`). Redirect/popup: `entry(url?, params?: RedirectOptions): Promise<void>`
	subscribeToEvent(eventName, callbackFn): { dispose: () => void }; // Subscribe to a single SDK event
	subscribeToAllEvents(callbackFn): { dispose: () => void }; // Subscribe to all SDK events
}
```

##### During server-side rendering

The SDK instance only exists in the browser: a client-only plugin creates it when the app starts, and it is also available as `useNuxtApp().$strivacity`. During SSR, `useStrivacity()` returns a **read-only** context built from the current request's session (`useSession()`), so no state is ever shared between requests:

| Member | During SSR |
| --- | --- |
| `isAuthenticated`, `idTokenClaims`, `accessToken`, `accessTokenExpired`, `accessTokenExpirationDate` | Derived from `useSession()`. With client-managed sessions the server cannot see browser storage, so `isAuthenticated` is `false` |
| `loading` | `false` with server-managed sessions, `true` with client-managed sessions (until the browser takes over) |
| `refreshToken` | Always `null` |
| `sdk.options`, `sdk.session` | Readable |
| `checkAuthentication()`, `init()` | Resolve immediately |
| `subscribeToEvent()`, `subscribeToAllEvents()` | No-ops (no events fire on the server) |
| `login()`, `register()`, `logout()`, `refresh()`, `revoke()`, `handleCallback()`, `entry()`, `tokenExchange()` and the matching `sdk.*` methods | Throw: authentication flows only run in the browser. Call them from `onMounted()` or event handlers |

#### useNativeLogin

Composable for managing native login flow state. Only available in `native` mode.

```ts
import type { NativeParams } from '@strivacity/sdk-nuxt';

const ctx = useNativeLogin({
	params: { /* login params */ },
	onLogin: (session) => { /* handle login */ },
	onError: (error) => { /* handle error */ },
	// ... other callbacks
});
```

##### Options

```ts
{
	params?: NativeParams; // Initial flow parameters
	onLogin?: (session: SessionData) => void | Promise<void>; // Called on successful login
	onClose?: () => void | Promise<void>; // Called when user closes the flow
	onError?: (error: Error) => void | Promise<void>; // Called on error
	onFallback?: (error: FallbackError) => void | Promise<void>; // Called when fallback needed
	onGlobalMessage?: (message: NativeFlowMessage) => void | Promise<void>; // Called for global messages
}
```

##### Returns

```ts
{
	// Reactive state
	loading: Ref<boolean>; // True while fetching next screen
	state: Ref<Partial<NativeFlowState>>; // Current flow state (screen, forms, layout, etc.)
	forms: Ref<Record<string, Record<string, unknown>>>; // Form data by form ID
	messages: Ref<Record<string, Record<string, NativeFlowMessage>>>; // Validation messages

	// Methods
	submitForm(formId: string, customBody?: Record<string, unknown>): Promise<void>; // Submit a form and advance to next screen
	setFormValue(formId: string, widgetId: string, value: unknown): void; // Update a single field value before submission
	setMessage(formId: string, widgetId: string, value: NativeFlowMessage): void; // Set a validation/info message on a widget
	triggerFallback(message?: string): void; // Manually trigger fallback to hosted journey
	triggerClose(): void; // Signal that the login flow was closed by the user
}
```

If you split widget rendering into sub-components, `useNativeLogin()` also `provide()`s its returned value under the hood - read it in any descendant with `useNativeLoginContext()` instead of threading props through every level:

```ts
const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
```

---

## Server SDK

This is the same backend-for-frontend ([BFF](../../README.md#bff)) server implementation as the [core Server SDK](../sdk-core/README.md#server-sdk), pre-wired as a Nitro plugin: `defineNuxtModule` builds a `BaseServerSDK<H3Event>` once per request and stores it on `event.context.strivacity.sdk`, and a default encrypted-cookie storage is used unless you configure something else.

### Setup

There's no server file to create or mount - the module registers everything (the plugin, the auth routes, the session-hydration middleware) automatically from the single `strivacity: {...}` key in `nuxt.config.ts`. See [Quick start](#quick-start) for the full configuration example, including `cookieSecret` (required unless you provide a custom `storage`).

### Accessing the session server-side

Call the auto-imported server composable `useStrivacity(event)` to read the current session (or invoke any other Server SDK method) from a server route, without going through the client SDK:

```ts
// server/api/profile.get.ts
export default defineEventHandler(async (event) => {
	const sdk = useStrivacity(event);
	const session = await sdk.getSession();

	if (!session) {
		throw createError({ statusCode: 401 });
	}

	return { idTokenClaims: session.claims };
});
```

`sdk.getSession()` returns what the page-render middleware gets: with `autoRefresh` (the default) it refreshes an expired (or within `refreshSkew`) session first when a refresh token exists, at most once per request (later calls in the same request share the result), and resolves to `null` if the refresh fails. The default cookie storage writes the rotated cookie to the response directly; a custom storage that queues its `Set-Cookie` headers on the event needs them flushed (`flushSetCookies`). If you return the session itself to the browser, strip the refresh and ID tokens with `toClientSession(session)` (from `@strivacity/sdk-nuxt/utils`).

> `useStrivacity(event)` throws if called on the client or without an `H3Event` - it's only available inside server routes, server plugins, and Nitro middleware.

<a id="server-storages"></a>
### Storages

By default the Server SDK stores tokens encrypted in http-only cookies and login state in a global in-memory `Map`. Custom storages (and custom `logging`/`httpClient` implementations) aren't passed inline in `nuxt.config.ts` - they're referenced by **file path**, because `nuxt.config.ts` is evaluated in a context that can't hold live server-only code. Point `storageFactoryPath`/`stateStorageFactoryPath` at a module that default-exports a factory function.

#### Built-in session storages

- **`createEncryptedCookieStorage(secret, options?)`** - default storage that keeps the session encrypted in an http-only cookie.
- **`createSessionIdCookieStorage(storage, options?)`** - puts only a small, random session-id cookie on the client and keeps the actual session payload in the `storage` you provide. It supports back-channel logout when `storage` implements `deleteByLogoutToken`.

```ts
// server/storage.ts
import { createSessionIdCookieStorage, createServerMemoryStorage } from '#imports';

export default function createStorageFactory() {
	return createSessionIdCookieStorage(
		createServerMemoryStorage(),
		{
			// maxAge: 30 * 24 * 60 * 60 // Without maxAge this is a browser-session cookie that gets cleared when the browser closes
		},
	);
}
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		// ...other options
		storageFactoryPath: '~~/server/storage', // default-exports the factory shown above
	},
});
```

#### Custom storage

For example you can use Redis via [unstorage](https://npmjs.com/package/unstorage).

The SDK always reads and writes the session under the same key (`storageKey`), and passes the current H3 event as the last argument. A storage that ignores the event would therefore share a single session across all users, so key the data per browser session instead. The easiest way is to wrap your key-value store with `createSessionIdCookieStorage`, which puts a random session id in a cookie and calls your store with that id as the key:

```ts
// server/storage.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import type { ServerStorage } from '@strivacity/sdk-nuxt';
import { createSessionIdCookieStorage } from '#imports';

const unstorageInstance = createStorage({ driver: redisDriver({ url: process.env.REDIS_URL }) });

// Session payload store - `key` is the per-browser session id provided by `createSessionIdCookieStorage`
// (raw get/set keep the serialized session string as-is)
const sessionStore: ServerStorage = {
	async get(key) {
		return unstorageInstance.getItemRaw<string>(`session:${key}`);
	},
	async set(key, value) {
		await unstorageInstance.setItemRaw(`session:${key}`, value);
	},
	async delete(key) {
		await unstorageInstance.removeItem(`session:${key}`);
	},
	// Required for back-channel logout support - see below.
	// Scans all stored sessions and removes those whose ID token claims match the logout token's sid or sub claim.
	async deleteByLogoutToken(logoutToken) {
		const keys = await unstorageInstance.getKeys('session');
		await Promise.all(
			keys.map(async (key) => {
				const raw = await unstorageInstance.getItemRaw<string>(key);
				if (!raw) return;
				const session = JSON.parse(raw);
				if ((logoutToken.sid && session.claims?.sid === logoutToken.sid) || (logoutToken.sub && session.claims?.sub === logoutToken.sub)) {
					await unstorageInstance.removeItem(key);
				}
			}),
		);
	},
};

export default function createStorageFactory() {
	return createSessionIdCookieStorage(sessionStore); // Custom Redis-backed session storage, keyed by a session-id cookie
}
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		// ...other options
		storageFactoryPath: '~~/server/storage', // default-exports the factory shown above
	},
});
```

> For more details on the storage interfaces, see the core SDK's [Custom storage](../sdk-core/README.md#server-storages) section.

### Back-channel logout

OIDC back-channel logout lets the authorization server terminate sessions server-to-server, without involving the browser. When the IDP sends a logout event (e.g. an admin terminates a session, or the user logs out from a different device), it POSTs a signed `logout_token` JWT to `/auth/backchannel-logout` - already registered by the module - which routes it to `sdk.handleBackChannelLogout(event)`.

The handler verifies the token's signature against the IDP's JWKS, validates the `iss`, `aud`, `iat` (freshness), and `jti` (replay protection) claims, requires the `http://schemas.openid.net/event/backchannel-logout` event and a `sid` or `sub` claim, then calls `storage.deleteByLogoutToken({ sid?, sub? })` to remove the matching session(s). It responds `200` on success, `400` for an invalid or malformed `logout_token`, `501` if the configured storage doesn't implement `deleteByLogoutToken`, and `500` if deleting the session fails.

> **The default encrypted-cookie storage does not support back-channel logout** because each cookie is bound to a single browser session - there is no server-side index to look up by `sid` or `sub`. To support back-channel logout, use [`createSessionIdCookieStorage`](#server-storages) with a `storage` that implements `deleteByLogoutToken`, e.g. `createServerMemoryStorage()` for local testing or the Redis-backed store from the [Custom storage](#server-storages) example above.

Configure the **Back-channel logout URI** in your Strivacity application settings to:

```
https://your-app.example.com/auth/backchannel-logout
```

For a complete explanation of the handshake and validation performed, see the core SDK's [Back-channel logout](../sdk-core/README.md#server-backchannel-logout) documentation.

### Server SDK API reference

`NuxtServerSDK` (`event.context.strivacity.sdk`, or the return value of `useStrivacity(event)`):

```ts
{
	options: NuxtServerSDKOptions; // resolved server SDK configuration

	// Session management
	getSession(): Promise<SessionData | null>; // read the current session; with `autoRefresh` (default) it refreshes an expired (or within `refreshSkew`) one first, once per request; null if the refresh fails (what the SSR middleware uses)
	updateSession(session): Promise<void>; // persist new session data
	refreshSession(): Promise<SessionData>; // refresh tokens using the refresh token
	revokeSession(): Promise<void>; // revoke tokens and clear the session
	getEntrySession(entryUrl): Promise<Record<string, string>>; // resolve an externally-initiated (embedded/native) entry URL
	completeLogin(params): Promise<SessionData>; // exchange an authorization code for tokens
	logout(postLogoutRedirectUri): Promise<URL>; // clear the session, returns the IDP end-session URL

	// Route handlers - each takes the `H3Event` and returns a Response; `handler` dispatches to the one matching the request path
	handleLogin(event): Promise<Response>;
	handleRegister(event): Promise<Response>;
	handleCallback(event): Promise<Response>;
	handleRefresh(event): Promise<Response>;
	handleRevoke(event): Promise<Response>;
	handleEntry(event): Promise<Response>;
	handleLogout(event): Promise<Response>;
	handleBackChannelLogout(event): Promise<Response>;
	handler(event): Promise<Response | null>; // null if no auth route matched
}
```

The session-management methods already close over the current `H3Event` - there's no `event` parameter to pass at the call site. The route handlers (`handle*()` and `handler()`) take the event explicitly, e.g. `await sdk.handler(event)`.

### Server configuration reference

The Server SDK accepts the same configuration as the client SDK (see [Configuration reference](#configuration-reference)), plus:

| Option | Type | Required | Default | Description |
| ------ | ---- | -------- | ------- | ----------- |
| `cookieSecret` | `string` | Only if using default storage | - | Encryption key (32+ random characters) for the http-only cookie session storage |
| `clientSecret` | `string` | Only for a confidential client | - | Client secret used to authenticate at the token and revocation endpoints. Keep it server-side - see [Client authentication](../sdk-core/README.md#server-client-authentication) |
| `tokenEndpointAuthMethod` | `'client_secret_basic' \| 'client_secret_post' \| 'none'` | No | `'client_secret_basic'` with `clientSecret`, otherwise `'none'` | How the client authenticates at the token and revocation endpoints (code exchange, refresh, revoke) |
| `storageFactoryPath` | `string` | No | Encrypted cookie storage | Path to a module default-exporting a `NuxtServerStorage` factory; see [Storages](#server-storages) |
| `stateStorageFactoryPath` | `string` | No | In-memory `Map` | Path to a module default-exporting an `SDKStorage` factory for the OAuth2 state parameter |
| `loggingFactoryPath` | `string` | No | - | Path to a module default-exporting an `SDKLogging` factory |
| `httpClientFactoryPath` | `string` | No | - | Path to a module default-exporting an `SDKHttpClient` factory |
| `authUriPrefix` | `string` | No | `'/auth'` | URL prefix under which the module registers the auth routes; with server-managed sessions `sdk.refresh()` and route guards send an expired session to `${authUriPrefix}/refresh` |
| `serverSessionUri` | `string \| null` | No | `` `${authUriPrefix}/login` `` | Enables server-managed sessions when set (the default); set to `null` to use client-managed sessions instead |
| `postLoginRedirectUri` | `string` | No | origin of `redirectUri` | Default redirect after login when no `?returnTo=` is given |
| `postLogoutRedirectUri` | `string` | No | origin of `redirectUri` | Default redirect after logout |
| `cookieMaxAge` | `number` | No | `2592000` (30 days) | Max age of the session cookie in seconds |

---

### Route guards

There's no client-side route guard composable in this SDK. Instead, add an opt-in Nuxt route middleware and apply it per-page.

With server-managed sessions the browser never refreshes tokens itself, and the module's middleware only refreshes during SSR, so a session can expire between client-side navigations. The guard below sends an expired session through the Server SDK's refresh route (`sdk.refresh({ returnTo })`, a full-page navigation that comes back to the target page) and aborts the client-side navigation:

```ts
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
	const { sdk } = useStrivacity();

	// With client-managed sessions the session lives in browser storage, so only the browser can decide.
	if (import.meta.server && !sdk.options.serverSessionUri) {
		return;
	}

	// Server-managed sessions, client-side navigation: send an expired session through the server's refresh route.
	// During SSR the module middleware already refreshed it.
	const session = useSession().value;

	if (import.meta.client && sdk.options.serverSessionUri && session && isSessionExpired(session)) {
		await sdk.refresh({ returnTo: to.fullPath });
		return abortNavigation();
	}

	const isAuthenticated = sdk.options.serverSessionUri ? !!useSession().value : await sdk.isAuthenticated;

	if (!isAuthenticated) {
		const returnToCookie = useCookie('sty.returnTo', { sameSite: 'lax', path: '/' });
		returnToCookie.value = to.path;

		return navigateTo('/login');
	}
});
```

```vue
<!-- app/pages/profile.vue -->
<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });
</script>
```

This is separate from the global session-hydration middleware the module registers with server-managed sessions (see [Quick start](#quick-start)) - that one runs during SSR only and only seeds `useSession()` (refreshing a near-expiry session first, see [Quick start](#quick-start)), it never redirects. A failed refresh leaves `useSession()` `undefined`, so the guard above sends the user to log in. The guard above is what actually protects a page, and you choose which pages need it. To protect every page instead, name it `auth.global.ts` (and skip `/login` and other public routes inside it): the module registers its own middleware first, so `useSession()` is already filled when any app middleware runs, global ones included.

---

## Shared features

The Nuxt SDK is built on top of the core SDK and supports all its features, on both the client and server:

- **[Storages](../sdk-core/README.md#storages)** - localStorage, sessionStorage, IndexedDB, Cache API, Memory, Worker (client), encrypted cookies, in-memory (server)
- **[SDK events](../sdk-core/README.md#sdk-events)** - Subscribe to authentication lifecycle events
- **[Logging](../sdk-core/README.md#logging)** - Built-in and custom logger support
- **[HTTP client](../sdk-core/README.md#http-client)** - Custom HTTP client integration
- **[Error handling](../sdk-core/README.md#error-handling)** - Typed error classes for different failure scenarios
- **[Utility functions](../sdk-core/README.md#utility-functions)** - Base64URL, JWT decoding, encryption, etc.
- **[Caching](../sdk-core/README.md#caching)** - OIDC metadata and JWKS caching

---

## Configuration reference

The client SDK accepts the same configuration as the core SDK - see the [core SDK configuration reference](../sdk-core/README.md#configuration-reference). See [Server configuration reference](#server-configuration-reference) above for the additional server-specific options.

---

## Migration guide

### Migrating to v4.0

v4 replaces the SDK's class-based flow architecture with function-based architecture, and unifies server-managed (BFF) session handling onto a shared Server SDK. The `strivacity: {...}` key is still the only configuration, but `serverSessionUri` now defaults to server-managed sessions: add a `cookieSecret`, or set `serverSessionUri: null` to keep v3's client-managed behaviour. Custom storage and logging are referenced by file path (`storageFactoryPath`, `loggingFactoryPath`, ...). Apps need to update their code if they rendered `<StyLoginRenderer>` (replaced by `useNativeLogin()`), used `mode: 'custom'`, drove `native` mode through the old `NativeFlowHandler`, or call SDK methods during server-side rendering.

#### `useStrivacity()` is read-only during SSR

In v3 the SDK instance was a module-level singleton that was also created on the server, so concurrent requests shared it. In v4 the SDK instance only exists in the browser, and during SSR `useStrivacity()` returns a read-only context derived from the current request's session (see [During server-side rendering](#during-server-side-rendering)). Move calls such as `login()`, `logout()` or `handleCallback()` into `onMounted()` or event handlers.

#### Class-based flows replaced by functions

In v3, flows were classes (`RedirectFlow`, `PopupFlow`, `NativeFlow`, `EmbeddedFlow`), and the only way to customize behavior beyond the built-in modes - for example, to proxy authentication through your own backend in a bespoke way - was `mode: 'custom'` with a `customFlow` class that extended one of them and override its methods:

```ts
// v3
import { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';

export class CustomNativeFlow extends NativeFlow {
	override async refresh(): Promise<void> {
		// ...
	}
}
```

v4 removes `mode: 'custom'`, the `customFlow` option, and the flow classes entirely. In their place, `createBaseFlow` (from `@strivacity/sdk-core/flows/base`) is a factory function that returns a plain object of methods closing over shared state - build your own flow by composing it, without extending anything:

```ts
// v4
import { createBaseFlow } from '@strivacity/sdk-core/flows/base';
import { getDefaultFlowState, getSDKOptions } from '@strivacity/sdk-core/utils';
import type { SDKInitConfig, SDKOptions } from '@strivacity/sdk-core/types';

export function createCustomFlow(initConfig: SDKInitConfig) {
	const state = getDefaultFlowState();
	const options = getSDKOptions<SDKOptions>(initConfig);
	const base = createBaseFlow(state, options);

	async function refresh(): Promise<void> {
		// ...
	}

	return { ...base, refresh };
}
```

This is a low-level `@strivacity/sdk-core` primitive - it's used the same way no matter which framework package you build on top of it. Wire it up by adding `factory: createCustomFlow` to the `strivacity: {...}` key in `nuxt.config.ts` - see [Custom flow](../sdk-core/README.md#custom-flow) in the core SDK README for the full pattern and usage example.

#### Server-managed sessions now share a common Server SDK

Server-managed sessions in `@strivacity/sdk-nuxt` are still configured entirely through the `strivacity: {...}` key in `nuxt.config.ts` - add `serverSessionUri` (and `cookieSecret`) and the module registers the auth routes and session-hydration middleware for you, with no server file or manual router mounting needed:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		// ...
		serverSessionUri: '/auth/login', // set to `null` for client-managed sessions - omitting this line still defaults to server-managed
		cookieSecret: process.env.COOKIE_SECRET,
	},
});
```

What changed under the hood in v4: this is now built on the same shared Server SDK (`createBaseServerSDK` from `@strivacity/sdk-core/server`) used by every other framework package, instead of a bespoke Nuxt-only implementation - PKCE, state, and session storage now work identically across all frameworks.

#### Native mode: no more `NativeFlowHandler`

In v3, `native` mode's `login()`/`register()` returned a separate `NativeFlowHandler` instance, and the flow was driven through that handler:

```ts
// v3
const handler = await sdk.login();
const state = await handler.startSession(sessionId);
const nextState = await handler.submitForm('formId', { identifier: 'user@example.com' });
await handler.finalizeSession(nextState.finalizeUrl);
```

v4 moves `startSession()`, `submitForm()`, and `finalizeSession()` directly onto the flow itself - in `@strivacity/sdk-nuxt` this is wrapped for you by the auto-imported [`useNativeLogin()`](#usenativelogin) composable:

```ts
// v4
const { state, forms, messages, submitForm } = useNativeLogin({
	params: { sessionId },
});

await submitForm('formId');
```

Update any code that calls `login()`/`register()` and drives the returned handler in `native` mode to use `useNativeLogin()` instead.

#### `storageTokenName` renamed to `storageKey`

The option that sets the session storage key is now called `storageKey`. The default is still `'sty.session'`, so existing sessions are kept unless you customized it.

#### `urlHandler` renamed to `uriHandler`

The `urlHandler` option is now called `uriHandler`, and the built-in handlers `redirectUrlHandler` / `popupUrlHandler` are now `redirectUriHandler` / `popupUriHandler`.

## Migrating to v3.0

### Entry API Major Changes

Strivacity SDK's `entry()` API now returns a structured object instead of a plain string. Check the example above in the usage section for more details.

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
