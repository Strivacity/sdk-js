# @strivacity/sdk-vue

Vue 3 SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Vue application with reactive composables.

Built on top of [@strivacity/sdk-core](../sdk-core) - see the [core SDK documentation](../sdk-core/README.md) for detailed information about authentication flows, configuration options, and advanced features.

**See also:**
- [Full Documentation](https://docs.strivacity.com/reference/overview) - Complete guide for all authentication modes
- [Example App](../../apps/vue) - Working Vue 3 example covering all four login modes
- [Core SDK](../sdk-core/README.md) - Framework-agnostic SDK documentation

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Quick start](#quick-start)
- [Authentication modes](#authentication-modes)
  - [redirect mode](#redirect-mode)
  - [popup mode](#popup-mode)
  - [embedded mode](#embedded-mode)
  - [native mode](#native-mode)
- [Composables API](#composables-api)
  - [useStrivacity](#usestrivacity)
  - [useNativeLogin](#usenativelogin)
- [Route guards](#route-guards)
- [Token management](#token-management)
- [Shared features](#shared-features)
- [Configuration reference](#configuration-reference)
- [Migration guide](#migration-guide)
- [Vulnerability Reporting](#vulnerability-reporting)
- [License](#license)
- [Contributing](#contributing)

---

## Prerequisites

- Vue 3.x
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-vue
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

## Quick start

### 1. Install the plugin

`createStrivacitySDK` returns a Vue [plugin](https://vuejs.org/guide/reusability/plugins.html) - install it once on the root app instance. It initializes the SDK and provides the auth context to every component in the tree via `provide`/`inject`.

```ts
// main.ts
import { createApp } from 'vue';
import { createStrivacitySDK } from '@strivacity/sdk-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
	createStrivacitySDK({
		mode: 'redirect', // authentication mode
		issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
		clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
		redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
		scopes: ['openid', 'profile', 'email'], // requested user permissions/data
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

---

## Authentication modes

### redirect mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The current browser tab navigates to the Strivacity-hosted login page and back to the configured `redirectUri` after authentication.

```ts
// main.ts
import { createApp } from 'vue';
import { createStrivacitySDK } from '@strivacity/sdk-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
	createStrivacitySDK({
		mode: 'redirect', // authentication mode
		issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
		clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
		redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
		scopes: ['openid', 'profile', 'email'], // requested user permissions/data
	}),
);

app.mount('#app');
```

#### Login

Call this to start the login flow. It redirects the user to the Strivacity login page in current browser tab, where they authenticate.

```vue
<!-- pages/Login.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useStrivacity } from '@strivacity/sdk-vue';
import type { RedirectFlow } from '@strivacity/sdk-vue';

const { login } = useStrivacity<RedirectFlow>();

onMounted(async () => {
	await login({
		// Optional parameters
		loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
		acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
		audiences: ['https://api.example.com'], // target resources for the access token
		locationMethod: 'assign', // window.location method: 'assign' adds to browser history, 'replace' doesn't (default: 'assign')
		targetWindow: 'self', // 'self' redirects current window, 'top' redirects top-level window (default: 'self')
	});
});
</script>

<template>
	<section>
		<h1>Redirecting to login...</h1>
	</section>
</template>
```

#### Handle the callback

Call this on your redirect URI page after the IDP sends the user back. It parses the query parameters from the callback URL, verifies the state matches what was stored during login (CSRF protection), exchanges the authorization code for tokens using PKCE, validates the ID token, and stores the session in the [configured storage](#storages). After that you can redirect to a protected page or render your app.

```vue
<!-- pages/Callback.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const { handleCallback } = useStrivacity();
const router = useRouter();
const searchParams = new URLSearchParams(window.location.search);

onMounted(async () => {
	if (searchParams.get('error')) {
		return await router.replace(`/error?${searchParams.toString()}`);
	}

	try {
		await handleCallback();
		await router.push('/profile');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
	}
});
</script>

<template>
	<section>
		<h1>Logging in...</h1>
	</section>
</template>
```

> The callback URL is automatically read from `window.location.href` if not provided. You can pass a custom URL as the first parameter: `await sdk.handleCallback(customUrl)`.

#### Registration

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```vue
<!-- pages/Register.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useStrivacity } from '@strivacity/sdk-vue';
import type { RedirectFlow } from '@strivacity/sdk-vue';

const { register } = useStrivacity<RedirectFlow>();

onMounted(async () => {
	await register({
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

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```vue
<!-- pages/Logout.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';

const { logout } = useStrivacity();

onMounted(async () => {
	await logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

#### Token management

Call these methods to manage the session and access token.

```vue
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { computed } from 'vue';

const { idTokenClaims, accessToken, refreshToken, init, refresh, revoke } = useStrivacity();

// Refresh the access token using the refresh token
// (automatically waits for SDK initialization and session loading)
await refresh();

// Revoke all tokens at the authorization server and clear the local session
// (automatically waits for SDK initialization and session loading)
await revoke();

// Get the current access and refresh tokens (synchronous property - ensure SDK is initialized first)
await init();
idTokenClaims.value // read-only property - returns the current ID token claims or null if not authenticated
accessToken.value; // read-only property - returns the current access token or null if not authenticated
refreshToken.value; // read-only property - returns the current refresh token or null if not authenticated
</script>
```

---

### popup mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The Strivacity login page opens in a separate window or tab. After authentication the opened window or tab closes itself and the parent page receives the session - no full-page navigation required.

```ts
// main.ts
import { createApp } from 'vue';
import { createStrivacitySDK, createDefaultLogging } from '@strivacity/sdk-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
	createStrivacitySDK({
		mode: 'popup', // authentication mode
		issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
		clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
		redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
		scopes: ['openid', 'profile', 'email'], // requested user permissions/data
	}),
);

app.mount('#app');
```

#### Login

Call this to start the login flow. It opens a popup window by default with the Strivacity login page, where the user authenticates. After that the popup closes itself and the session is stored in the [configured storage](#storages).

By default a centered popup window opens. Pass `popupWindowTarget` to change where the window opens, and `popupWindowFeatures` to control its size and position:

```vue
<!-- pages/Login.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';
import type { PopupFlow } from '@strivacity/sdk-vue';

const router = useRouter();
const { login } = useStrivacity<PopupFlow>();

onMounted(async () => {
	try {
		await login({
			// Optional parameters
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
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

		// User authenticated - navigate to a protected page
		window.location.href = '/profile';
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
	}
});
</script>

<template>
	<section>
		<h1>Opening login popup...</h1>
	</section>
</template>
```

#### Handle the callback

The popup resolves automatically - no callback page is needed. Token exchange happens inside the popup and the result is posted back to the opener window.

#### Registration

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```vue
<!-- pages/Register.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';
import type { PopupFlow } from '@strivacity/sdk-vue';

const router = useRouter();
const { register } = useStrivacity<PopupFlow>();

onMounted(async () => {
	try {
		await register({
			// Optional parameters
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
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

		// User authenticated - navigate to a protected page
		window.location.href = '/profile';
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
	}
});
</script>

<template>
	<section>
		<h1>Opening registration popup...</h1>
	</section>
</template>
```

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```vue
<!-- pages/Logout.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';

const { logout } = useStrivacity();

onMounted(async () => {
	await logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

#### Token management

Call these methods to manage the session and access token.

```vue
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { computed } from 'vue';

const { idTokenClaims, accessToken, refreshToken, init, refresh, revoke } = useStrivacity();

// Refresh the access token using the refresh token
// (automatically waits for SDK initialization and session loading)
await refresh();

// Revoke all tokens at the authorization server and clear the local session
// (automatically waits for SDK initialization and session loading)
await revoke();

// Get the current access and refresh tokens (synchronous property - ensure SDK is initialized first)
await init();
idTokenClaims.value // read-only property - returns the current ID token claims or null if not authenticated
accessToken.value; // read-only property - returns the current access token or null if not authenticated
refreshToken.value; // read-only property - returns the current refresh token or null if not authenticated
</script>
```

---

### embedded mode

> For details on how this mode works, see the [embedded journey documentation](https://docs.strivacity.com/reference/embedded-journey).

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your Strivacity tenant cluster once during application bootstrap, alongside SDK initialization:

```ts
// main.ts
import { createApp } from 'vue';
import { createStrivacitySDK } from '@strivacity/sdk-vue';
import { injectScript } from '@strivacity/sdk-vue';

// Load web components bundle
injectScript('sty-components', 'https://<YOUR_TENANT_DOMAIN>/assets/components/bundle.js');

const app = createApp(App);

app.use(
	createStrivacitySDK({
		mode: 'embedded', // authentication mode
		issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
		clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
		redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
		scopes: ['openid', 'profile', 'email'], // requested user permissions/data
	}),
);

app.mount('#app');
```

#### Login / Register

In embedded mode `<sty-login>` web component does not take `issuer`, `clientId`, or `redirectUri` as attributes - those come from the SDK configuration above. Place it on your login page together with `sty-notifications` (toast-style system notifications) and `sty-language-selector` (a language switcher for the login flow):

```vue
<!-- pages/Login.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
const searchParams = new URLSearchParams(window.location.search);

// Optional: Resume a session started from an entry URL (e.g., password reset)
const sessionId = searchParams.get('session_id');
const shortAppId = searchParams.get('short_app_id');
const lang = searchParams.get('language') ?? navigator.language;

const params = {
	loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
	acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
	audiences: ['https://api.example.com'], // target resources for the access token
	language: 'en-US', // set the UI language (BCP 47 language tag)
	prompt: 'login', // use 'create' to open the registration flow instead
};

async function onLogin() {
	await router.push('/profile');
}

function onClose() {
	window.location.reload();
}

async function onError(event: CustomEvent) {
	await router.push(`/error?message=${encodeURIComponent(event.detail)}`);
}
</script>

<template>
	<section>
		<sty-notifications></sty-notifications>
		<sty-login
			:params.prop="params"
			:sessionId="sessionId"
			:shortAppId="shortAppId"
			:lang="lang"
			@login="onLogin"
			@close="onClose"
			@error="onError"
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
```

##### Controlling when the flow starts

By default the login flow starts automatically as soon as `<sty-login>` connects to the DOM. Add the `lazy` attribute to take manual control, then call `start()` when ready. `start()` accepts an optional params object forwarded to the authorization request, or you can set params via the `params` property before the component mounts:

```vue
<!-- pages/Login.vue -->
<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import type { LoginComponent } from '@strivacity/sdk-vue/types';

const router = useRouter();
const loginEl = useTemplateRef<LoginComponent>('loginEl');

async function onStartClick() {
	await loginEl.value?.start({
		loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
		acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
		audiences: ['https://api.example.com'], // target resources for the access token
		language: 'en-US', // set the UI language (BCP 47 language tag)
		prompt: 'login', // use 'create' to open the registration flow instead
	});
}

async function onLogin() {
	await router.push('/profile');
}

async function onError(event: CustomEvent) {
	await router.push(`/error?message=${encodeURIComponent(event.detail)}`);
}
</script>

<template>
	<section>
		<sty-notifications></sty-notifications>
		<button @click="onStartClick">Continue to login</button>
		<sty-login ref="loginEl" lazy @login="onLogin" @error="onError"></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
```

You can also set params via the `params` property before calling `start()`:

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue';
import type { LoginComponent } from '@strivacity/sdk-vue/types';

const loginEl = useTemplateRef<LoginComponent>('loginEl');

async function onStartClick() {
	if (!loginEl.value) {
		return;
	}

	loginEl.value.params = {
		loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
		acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
		audiences: ['https://api.example.com'], // target resources for the access token
		language: 'en-US', // set the UI language (BCP 47 language tag)
		prompt: 'login', // use 'create' to open the registration flow instead
	};
	await loginEl.value.start();
}
</script>

<template>
	<sty-login ref="loginEl" lazy @login="onLogin"></sty-login>
	<button @click="onStartClick">Start Login</button>
</template>
```

##### Login events

The `<sty-login>` element dispatches `login`, `close`, and `error` custom events. Listen to them using Vue's `@` directive:

```vue
<!-- pages/Login.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

async function onLogin() {
	// User authenticated - navigate to a protected page
	await router.push('/profile');
}

function onClose() {
	// User cancelled or closed the login flow
	window.location.reload();
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
import { onMounted, onUnmounted } from 'vue';

function onNotification(event: Event) {
	const customEvent = event as CustomEvent;
	if (customEvent.detail.action === 'show') {
		// Add new notification to your custom notification system
		const notification = customEvent.detail.notification;
		console.log('New notification:', notification);
		// Handle the notification display in your own UI
	} else if (customEvent.detail.action === 'clear') {
		// Clear all notifications
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
import { ref, useTemplateRef } from 'vue';

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

#### Handle the callback

No separate callback page is needed. The `<sty-login>` component handles the entire authentication flow automatically, including token exchange, and dispatches a `login` event when authentication completes successfully.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing page to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login page**

Forward the parameters as query params to your login page:

```vue
<!-- pages/Entry.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';
import type { EmbeddedFlow } from '@strivacity/sdk-vue';

const { entry } = useStrivacity<EmbeddedFlow>();
const router = useRouter();

onMounted(async () => {
	try {
		const data = await entry();

		// Redirect to login page with flow parameters
		const params = new URLSearchParams({
			session_id: data.session_id,
			short_app_id: data.short_app_id,
			language: data.language,
		});
		window.location.href = `/login?${params}`;
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
	}
});
</script>

<template>
	<section>
		<h1>Loading...</h1>
	</section>
</template>
```

Then on your login page, read the parameters and pass them to `<sty-login>`:

```vue
<!-- pages/Login.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
const searchParams = new URLSearchParams(window.location.search);

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

**Option 2: Render login on the entry page**

Pass the parameters directly to `<sty-login>` on the same page:

```vue
<!-- pages/Entry.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';
import type { EmbeddedFlow } from '@strivacity/sdk-vue';

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
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
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

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```vue
<!-- pages/Logout.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';

const { logout } = useStrivacity();

onMounted(async () => {
	await logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

#### Token management

Call these methods to manage the session and access token.

```vue
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { computed } from 'vue';

const { idTokenClaims, accessToken, refreshToken, init, refresh, revoke } = useStrivacity();

// Refresh the access token using the refresh token
// (automatically waits for SDK initialization and session loading)
await refresh();

// Revoke all tokens at the authorization server and clear the local session
// (automatically waits for SDK initialization and session loading)
await revoke();

// Get the current access and refresh tokens (synchronous property - ensure SDK is initialized first)
await init();
idTokenClaims.value // read-only property - returns the current ID token claims or null if not authenticated
accessToken.value; // read-only property - returns the current access token or null if not authenticated
refreshToken.value; // read-only property - returns the current refresh token or null if not authenticated
</script>
```

---

### native mode

> For details on how this mode works, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey).

You build the entire login UI with your own components. Call `startSession()` on the SDK instance to get the initial `NativeFlowState`, render the widgets, submit each form step with `submitForm()`, and repeat until `state.finalizeUrl` is set - then call `finalizeSession()`.

> The example below shows a simplified custom implementation. For a complete native renderer with all widget types, see the [example app](../../apps/vue/src/components/auth/native/NativeLogin.vue).

#### Login / Register

Create a login page using `useNativeLogin`:

```vue
<!-- pages/Login.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useNativeLogin } from '@strivacity/sdk-vue';

const router = useRouter();
const searchParams = new URLSearchParams(window.location.search);

const { state, forms, messages, loading, submitForm } = useNativeLogin({
	params: {
		prompt: 'login', // use 'create' to open the registration flow instead
		language: 'en-US', // set the UI language (BCP 47 language tag)
		sdk: 'web-minimal', // rendering mode: 'web-minimal' for simplified rendering (see below), 'web' (default) for full rendering hints and branding
		sessionId: null, // pass a session ID to resume an existing flow
	},
	onLogin: async () => {
		await router.push('/profile');
	},
	onClose: () => {
		window.location.reload();
	},
	onError: async (error) => {
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
	},
	onFallback: (error) => {
		// Fallback to hosted journey if native widget not supported
		window.location.href = error.url.toString();
	},
	onGlobalMessage: (message) => {
		alert(message.text);
	},
});

async function handleSubmit(formId: string) {
	await submitForm(formId);
}
</script>

<template>
	<section v-if="loading">
		<h1>Loading...</h1>
	</section>

	<section v-else-if="state.screen === 'identifier'">
		<h2>Sign In</h2>
		<form @submit.prevent="handleSubmit('identifier')">
			<input
				v-model="forms['identifier'].identifier"
				type="text"
				placeholder="Email"
			/>
			<div v-if="messages['identifier'].identifier" class="error">
				{{ messages['identifier'].identifier.text }}
			</div>
			<button type="submit">Continue</button>
		</form>
	</section>

	<section v-else-if="state.screen === 'password'">
		<h2>Enter Password</h2>
		<form @submit.prevent="handleSubmit('password')">
			<input
				v-model="forms['password'].password"
				type="password"
				placeholder="Password"
			/>
			<div v-if="messages['password'].password" class="error">
				{{ messages['password'].password.text }}
			</div>
			<button type="submit">Sign In</button>
		</form>
	</section>
</template>
```

#### Handle the callback

No separate callback page is needed. Once `state.finalizeUrl` is set, `submitForm()` automatically finalizes the session internally to exchange the authorization code for tokens and store the session.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing page to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login page**

Forward the parameters as query params to your login page:

```vue
<!-- pages/Entry.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';
import type { EmbeddedFlow } from '@strivacity/sdk-vue';

const { entry } = useStrivacity<EmbeddedFlow>();
const router = useRouter();

onMounted(async () => {
	try {
		const data = await entry();

		// Redirect to login page with flow parameters
		const params = new URLSearchParams({
			session_id: data.session_id,
			short_app_id: data.short_app_id,
			language: data.language,
		});
		window.location.href = `/login?${params}`;
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
	}
});
</script>

<template>
	<section>
		<h1>Loading...</h1>
	</section>
</template>
```

Then on your login page, read query parameters from the URL and pass it to `useNativeLogin` to resume the flow, exactly as shown in the Login / Register example above:

```vue
<!-- pages/Login.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
const searchParams = new URLSearchParams(window.location.search);

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

**Option 2: Render login on the entry page**

Pass the parameters directly to `<sty-login>` on the same page:

```vue
<!-- pages/Entry.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';
import type { EmbeddedFlow } from '@strivacity/sdk-vue';

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
		await router.push(`/error?message=${encodeURIComponent(error.message)}`);
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

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```vue
<!-- pages/Logout.vue -->
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';

const { logout } = useStrivacity();

onMounted(async () => {
	await logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

#### Token management

Call these methods to manage the session and access token.

```vue
<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { computed } from 'vue';

const { idTokenClaims, accessToken, refreshToken, init, refresh, revoke } = useStrivacity();

// Refresh the access token using the refresh token
// (automatically waits for SDK initialization and session loading)
await refresh();

// Revoke all tokens at the authorization server and clear the local session
// (automatically waits for SDK initialization and session loading)
await revoke();

// Get the current access and refresh tokens (synchronous property - ensure SDK is initialized first)
await init();
idTokenClaims.value // read-only property - returns the current ID token claims or null if not authenticated
accessToken.value; // read-only property - returns the current access token or null if not authenticated
refreshToken.value; // read-only property - returns the current refresh token or null if not authenticated
</script>
```

---

## Composables API

### useStrivacity

The main composable for accessing the SDK instance and authentication state.

```ts
import { useStrivacity } from '@strivacity/sdk-vue';
import type { RedirectFlow } from '@strivacity/sdk-vue';

const ctx = useStrivacity<RedirectFlow>();
```

#### Returns

```ts
{
	// SDK instance (access any SDK method)
	sdk: RedirectFlow | PopupFlow | EmbeddedFlow | NativeFlow;

	// Reactive state
	loading: Ref<boolean>; // True during initialization
	isAuthenticated: Ref<boolean>; // True if user has valid session
	idTokenClaims: Ref<IdTokenClaims | null>; // Decoded ID token claims
	accessToken: Ref<string | null>; // Current access token
	refreshToken: Ref<string | null>; // Current refresh token

	// Methods (all are async)
	login(params?: LoginParams): Promise<void>; // Start login flow
	register(params?: LoginParams): Promise<void>; // Start registration flow
	handleCallback(url?: string): Promise<void>; // Handle OAuth callback
	logout(params?: LogoutParams): Promise<void>; // End session
	refresh(): Promise<void>; // Refresh access token
	revoke(): Promise<void>; // Revoke tokens
	entry(): Promise<EntryData>; // Handle external entry (embedded/native only)
}
```

### useNativeLogin

Composable for managing native login flow state. Only available in `native` mode.

```ts
import { useNativeLogin } from '@strivacity/sdk-vue';
import type { NativeParams } from '@strivacity/sdk-vue';

const ctx = useNativeLogin({
	params: { /* login params */ },
	onLogin: (session) => { /* handle login */ },
	onError: (error) => { /* handle error */ },
	// ... other callbacks
});
```

#### Options

```ts
{
	params?: NativeParams; // Initial flow parameters
	onLogin?: (session: Session) => void; // Called on successful login
	onClose?: () => void; // Called when user closes the flow
	onError?: (error: unknown) => void; // Called on error
	onFallback?: (error: FallbackError) => void; // Called when fallback needed
	onGlobalMessage?: (message: NativeFlowMessage) => void; // Called for global messages
}
```

#### Returns

```ts
{
	// Reactive state
	loading: Ref<boolean>; // True while fetching next screen
	state: Ref<NativeFlowState>; // Current flow state (screen, forms, layout, etc.)
	forms: Ref<Record<string, Record<string, unknown>>>; // Form data by form ID
	messages: Ref<Record<string, Record<string, NativeFlowMessage>>>; // Validation messages

	// Methods
	submitForm(formId: string): Promise<void>; // Submit a form and advance to next screen
	triggerFallback(message?: string): void; // Manually trigger fallback to hosted journey
}
```

---

## Route guards

Protect routes that require authentication using Vue Router's navigation guards:

```ts
// router.ts
import { createRouter, createWebHistory } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: '/profile',
			component: Profile,
			beforeEnter: async () => {
				const { sdk, isAuthenticated } = useStrivacity();
				await sdk.init();

				if (!isAuthenticated.value) {
					return '/login';
				}
			},
		},
	],
});
```

---

## Shared features

The Vue SDK is built on top of the core SDK and supports all its features:

- **[Storages](../sdk-core/README.md#storages)** - localStorage, sessionStorage, IndexedDB, Cache API, Memory, Worker
- **[SDK events](../sdk-core/README.md#sdk-events)** - Subscribe to authentication lifecycle events
- **[Logging](../sdk-core/README.md#logging)** - Built-in and custom logger support
- **[HTTP client](../sdk-core/README.md#http-client)** - Custom HTTP client integration
- **[Error handling](../sdk-core/README.md#error-handling)** - Typed error classes for different failure scenarios
- **[Utility functions](../sdk-core/README.md#utility-functions)** - Base64URL, JWT decoding, encryption, etc.
- **[Caching](../sdk-core/README.md#caching)** - OIDC metadata and JWKS caching

---

## Configuration reference

The Vue SDK accepts the same configuration as the core SDK. For detailed information about each option, see the [core SDK configuration reference](../sdk-core/README.md#configuration-reference).

---

## Advanced

### Ionic / Capacitor support

The SDK works with Ionic and Capacitor applications. For native mobile platforms (iOS/Android), you need to override the default `urlHandler`, `callbackHandler`, and `storage` implementations to integrate with Capacitor plugins.

```ts
// main.ts
import { createApp } from 'vue';
import { createStrivacitySDK, SDKStorage, SDKHttpClient } from '@strivacity/sdk-vue';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler, redirectCallbackHandler } from '@strivacity/sdk-core/utils/handlers';
import type { PluginListenerHandle } from '@capacitor/core';
import type { HttpClientResponse } from '@strivacity/sdk-vue';
import App from './App.vue';

// Custom HTTP client using Capacitor's HTTP plugin
class CapacitorHttpClient extends SDKHttpClient {
	async request<T>(url: string, options?: RequestInit): Promise<HttpClientResponse<T>> {
		const response = await CapacitorHttp.request({
			url,
			method: options?.method || 'GET',
			headers: (options?.headers as Record<string, string>) || {},
			data: options?.body,
			webFetchExtra: options,
		});

		return {
			headers: new Headers(response.headers),
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			statusText: '',
			url: response.url,
			json: () => Promise.resolve(response.data),
			text: () => Promise.resolve(response.data),
		};
	}
}

// Custom storage using Capacitor Preferences
class CapacitorStorage extends SDKStorage {
	async get(key: string): Promise<string | null> {
		const { value } = await Preferences.get({ key });
		return value;
	}

	async set(key: string, value: string): Promise<void> {
		await Preferences.set({ key, value });
	}

	async delete(key: string): Promise<void> {
		await Preferences.remove({ key });
	}
}

const app = createApp(App);

app.use(
	createStrivacitySDK({
		mode: 'redirect',
		issuer: 'https://<YOUR_TENANT_DOMAIN>',
		clientId: 'YOUR_CLIENT_ID',
		redirectUri: 'https://your-app.example.com/callback',
		scopes: ['openid', 'profile', 'email'],

		// Use Capacitor HTTP on native platforms
		httpClient: CapacitorHttpClient,

		// Use Capacitor Preferences on native platforms, localStorage on web
		storage: Capacitor.getPlatform() === 'web' ? LocalStorage : CapacitorStorage,

		// Handle URL redirects with InAppBrowser on native platforms
		async urlHandler(url, responseMode) {
			if (Capacitor.getPlatform() === 'web') {
				return redirectUrlHandler(url, responseMode);
			} else {
				await InAppBrowser.openInWebView({
					url,
					options: { /* Configure InAppBrowser options */ },
				});
			}
		},

		// Handle OAuth callback with InAppBrowser listeners on native platforms
		async callbackHandler(url, responseMode) {
			if (Capacitor.getPlatform() === 'web') {
				return redirectCallbackHandler(url, responseMode);
			}

			return new Promise(async (resolve, reject) => {
				let navigationListener: PluginListenerHandle | null = null;
				let finishListener: PluginListenerHandle | null = null;
				let userCancelled = true;

				const cleanupListeners = async () => {
					if (navigationListener) {
						await navigationListener.remove();
						navigationListener = null;
					}
					if (finishListener) {
						await finishListener.remove();
						finishListener = null;
					}
				};

				try {
					// Listen for page navigation in InAppBrowser
					navigationListener = await InAppBrowser.addListener(
						'browserPageNavigationCompleted',
						async (event) => {
							const navigatedUrl = event.url;

							// Check if the navigated URL matches our callback URL
							if (navigatedUrl && navigatedUrl.startsWith(url)) {
								try {
									const urlInstance = new URL(navigatedUrl);
									const dataString = responseMode === 'query'
										? urlInstance.search
										: urlInstance.hash;
									const params = Object.fromEntries(
										new URLSearchParams(dataString.slice(1))
									);

									userCancelled = false;
									await InAppBrowser.close();
									resolve(params);
								} catch (error) {
									await InAppBrowser.close();
									reject(error);
								}
							}
						}
					);

					// Listen for browser close event
					finishListener = await InAppBrowser.addListener('browserClosed', async () => {
						await cleanupListeners();

						if (userCancelled) {
							reject(new Error('InAppBrowser flow cancelled by user.'));
						}
					});
				} catch (error) {
					await cleanupListeners();
					reject(error);
				}
			});
		},
	}),
);

app.mount('#app');
```

> For more details on custom handlers and storage implementations, see the [core SDK advanced section](../sdk-core/README.md#advanced).

### Server-side session (BFF) mode

Set `serverSessionUri` to route login through your own server instead of talking to the identity provider directly from the browser - tokens are then stored server-side and never reach client-side JavaScript. See [Server-side session management](../sdk-core/README.md#server-side-session-management) in the core SDK README for the full explanation and how to read the session on the client.

```ts
// main.ts
app.use(
	createStrivacitySDK({
		mode: 'redirect',
		issuer: 'https://<YOUR_TENANT_DOMAIN>',
		clientId: 'YOUR_CLIENT_ID',
		redirectUri: 'https://your-app.example.com/callback',
		scopes: ['openid', 'profile', 'email'],
		serverSessionUri: '/api/auth/login', // Requests are routed through your server; tokens are NOT written to client storage
	}),
);
```

See [`apps/vue`](../../apps/vue) paired with [`apps/backend`](../../apps/backend) for a working example. See also [Using the backend app with SPA apps](../../README.md#using-the-backend-app-with-spa-apps) in the root README.

---

## Migration guide

### Migrating to v4.0

v4 replaces the SDK's class-based flow architecture with function-based architecture, and adds first-class support for server-managed (BFF) sessions. `createStrivacitySDK()`, `useStrivacity()`, `useNativeLogin()`, and the built-in `redirect`/`popup`/`embedded`/`native` modes are unchanged - only apps that used `mode: 'custom'` or drove `native` mode through the old `NativeFlowHandler` need to update their code.

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
	const options = getSDKOptions<SDKOptions>(state, initConfig);
	const base = createBaseFlow(state, options);

	async function refresh(): Promise<void> {
		// ...
	}

	return { ...base, refresh };
}
```

This is a low-level `@strivacity/sdk-core` primitive - it's used the same way no matter which framework package you build on top of it. Wire it up by adding `factory: createCustomFlow` to the options object passed to `createStrivacitySDK()` - see [Custom flow](../sdk-core/README.md#custom-flow) in the core SDK README for the full pattern and usage example.

#### Server-managed sessions (BFF) are now built in

In v3, routing authentication through your own backend meant writing a custom flow class like the one above yourself: manually calling `fetch()` against hand-written endpoints, and reimplementing PKCE/state handling, CSRF protection, and server-side token storage on your own.

`@strivacity/sdk-vue` doesn't ship its own server - it's a client SDK for SPAs, meant to pair with a separate backend. v4 replaces the old hand-rolled approach with a single option, `serverSessionUri`, on `createStrivacitySDK()`, paired with the Server SDK (`createBaseServerSDK` from `@strivacity/sdk-core/server`) running on that backend - PKCE, state, and session storage are all handled by the Server SDK:

```ts
// v4
app.use(
	createStrivacitySDK({
		// ...
		serverSessionUri: '/api/auth/login', // requests are routed through your server; tokens are never written to client storage
	}),
);
```

See [`apps/vue`](../../apps/vue) paired with [`apps/backend`](../../apps/backend) for a working example.

#### Native mode: no more `NativeFlowHandler`

In v3, `native` mode's `login()`/`register()` returned a separate `NativeFlowHandler` instance, and the flow was driven through that handler:

```ts
// v3
const handler = await sdk.login();
const state = await handler.startSession(sessionId);
const nextState = await handler.submitForm('formId', { identifier: 'user@example.com' });
await handler.finalizeSession(nextState.finalizeUrl);
```

v4 moves `startSession()`, `submitForm()`, and `finalizeSession()` directly onto the flow itself - in `@strivacity/sdk-vue` this is wrapped for you by the [`useNativeLogin()`](#usenativelogin) composable:

```ts
import { useNativeLogin } from '@strivacity/sdk-vue';

// v4
const { state, forms, messages, submitForm } = useNativeLogin({
	params: { sessionId },
});

await submitForm('formId');
```

Update any code that calls `login()`/`register()` and drives the returned handler in `native` mode to use `useNativeLogin()` instead.

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
