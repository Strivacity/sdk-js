# Strivacity SDK - Vue Example App

This example application demonstrates how to integrate the [@strivacity/sdk-vue](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-vue) SDK into a Vue 3 application using Vue Router and the Composition API. It covers all supported authentication modes (`redirect`, `popup`, `native`, `embedded`) and shows how to structure route-based authentication flows.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

The SDK is registered as a Vue plugin and exposes the `useStrivacity` composable, which provides reactive authentication state and methods throughout the application. Vue Router is used for client-side navigation with route-based authentication guards.

## Requirements

- Vue.js: 3+
- Node.js: 20 LTS+

## Install

```bash
pnpm install
```

Create a `.env.local` file in the repository root:

```env
VITE_MODE=redirect
VITE_ISSUER=your-cluster-domain
VITE_CLIENT_ID=your-client-id
VITE_SCOPES=openid profile email
VITE_REDIRECT_URI=http://localhost:4200/callback
```

Then start the development server:

```bash
pnpm app:vue:serve
```

## Usage

### Initialization

The SDK is registered as a Vue plugin in `src/main.ts`. All environment variables are read from the Vite environment and passed directly to `createStrivacitySDK`.

The file also dynamically imports `bundle.js` from the configured issuer domain. This script is served by the Strivacity cluster and registers the Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`, etc.) used in `embedded` mode:

```typescript
import { createApp } from 'vue';
import { router } from './router';
import { createStrivacitySDK, DefaultLogging } from '@strivacity/sdk-vue';
import AppComponent from './components/app.component.vue';

void import(`${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);

const app = createApp(AppComponent);
const sdk = createStrivacitySDK({
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.vue',
	logging: DefaultLogging,
});

app.use(router);
app.use(sdk);
```

Components access authentication state through the `useStrivacity` composable, which returns reactive refs:

```vue
<script setup>
import { useStrivacity } from '@strivacity/sdk-vue';
import { computed } from 'vue';

const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
const userName = computed(() => `${idTokenClaims.value?.given_name ?? ''} ${idTokenClaims.value?.family_name ?? ''}`);
</script>

<template>
	<div v-if="loading">Loading...</div>
	<div v-else-if="isAuthenticated">Welcome, {{ userName }}!</div>
</template>
```

### Login / Register

`src/pages/login.page.vue` and `src/pages/register.page.vue` initiate the authentication flow. The active mode determines how the UI is rendered:

- **`redirect`** — `login()` is called on mount; the user is taken to the identity provider in the same window.
- **`popup`** — `login()` is called on mount; authentication happens in a popup window.
- **`native`** — The `StyLoginRenderer` component renders the login UI inline using your custom widget components.
- **`embedded`** — The `<sty-login>` web component (loaded via `bundle.js` from the cluster) takes over rendering.

`src/pages/callback.page.vue` handles the response from the identity provider. It calls `handleCallback()` and redirects to `/profile` on success:

```vue
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
	try {
		await handleCallback();
		await router.push('/profile');
	} catch (error) {
		console.error('Error during callback handling:', error);
	}
});
</script>
```

### Refresh token

Token refresh runs automatically when the SDK detects an expired access token. The `refresh` method is also available via the composable for manual invocation:

```vue
<script setup>
import { useStrivacity } from '@strivacity/sdk-vue';

const { refresh } = useStrivacity();
</script>
```

### Revoke session / logout

`src/pages/revoke.page.vue` revokes the current session tokens without a full logout. It checks `isAuthenticated` before calling `revoke()` and then returns to the home page:

```vue
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { isAuthenticated, revoke } = useStrivacity();

onMounted(async () => {
	if (isAuthenticated.value) {
		await revoke();
	}
	await router.push('/');
});
</script>
```

`src/pages/logout.page.vue` performs a full logout. When the user is authenticated, `logout()` is called with `postLogoutRedirectUri` set to the application origin; otherwise the user is immediately redirected home:

```vue
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { isAuthenticated, logout } = useStrivacity();

onMounted(async () => {
	if (isAuthenticated.value) {
		await logout({ postLogoutRedirectUri: location.origin });
	} else {
		await router.push('/');
	}
});
</script>
```

### Resume an externally-initiated flow

`src/pages/entry.page.vue` handles flows started by an external process (e.g. password reset, magic link, invite). On mount it calls `entry()`, which processes the incoming URL and returns a `session_id` (and optionally a `short_app_id`). These are forwarded as query parameters to `/callback` to resume the flow; if no data is returned the user is redirected to the home page:

```vue
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { entry } = useStrivacity();

onMounted(async () => {
	try {
		const data = await entry();

		if (data && Object.keys(data).length > 0) {
			await router.push(`/callback?${new URLSearchParams(data).toString()}`);
		} else {
			await router.push('/');
		}
	} catch (error) {
		alert(error);
		await router.push('/');
	}
});
</script>
```

The callback page detects the `session_id` parameter and forwards it to `/login` to continue the native or embedded flow, instead of running the standard `handleCallback()` path:

```vue
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
	const url = new URL(location.href);
	const sessionId = url.searchParams.get('session_id');

	if (sessionId) {
		await router.push(`/login?${url.searchParams}`);
	} else {
		try {
			await handleCallback();
			await router.push('/profile');
		} catch (error) {
			console.error('Error during callback handling:', error);
		}
	}
});
</script>
```

The login page extracts `session_id` and `short_app_id` from the URL on load, cleans up the URL, and passes them to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new login. The `short_app_id` is used in `embedded` mode to identify the application within the `<sty-login>` web component:

```vue
<script setup>
import { ref } from 'vue';

const shortAppId = (ref < string) | (null > null);
const sessionId = (ref < string) | (null > null);

if (location.search !== '') {
	const url = new URL(window.location.href);
	shortAppId.value = url.searchParams.get('short_app_id');
	sessionId.value = url.searchParams.get('session_id');
	url.search = '';
	history.replaceState({}, '', url.toString());
}
</script>
```

You can also navigate directly to `/login?session_id=<id>` to resume a flow without going through the entry page, which is useful when the `session_id` is obtained through your own backend logic.

## Logging

Enable the built-in console logger by passing `logging: DefaultLogging` to the SDK options:

```typescript
import { createStrivacitySDK, DefaultLogging } from '@strivacity/sdk-vue';

const sdk = createStrivacitySDK({
	// ...other options
	logging: DefaultLogging,
});
```

The default logger writes to the browser console and prefixes messages with the `xEventId` correlation ID when available.

To use a custom logger, implement the `SDKLogging` interface and register your class in the SDK options:

```typescript
import type { SDKLogging } from '@strivacity/sdk-vue';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		console.debug(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	info(message: string): void {
		console.info(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	warn(message: string): void {
		console.warn(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	error(message: string, error: Error): void {
		console.error(this.xEventId ? `(${this.xEventId}) ${message}` : message, error);
	}
}
```

```typescript
import { createStrivacitySDK } from '@strivacity/sdk-vue';
import { MyLogger } from './logging/MyLogger';

const sdk = createStrivacitySDK({
	// ...other options
	logging: MyLogger,
});
```

## Pages

| Page     | Path                          | Description                                                                                                                                                        |
| -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home     | `src/pages/index.page.vue`    | Public landing page. Displays user info when authenticated.                                                                                                        |
| Login    | `src/pages/login.page.vue`    | Entry point for the authentication flow. Accepts optional `session_id` and `short_app_id` URL parameters to resume an existing flow instead of starting a new one. |
| Register | `src/pages/register.page.vue` | Entry point for the registration flow. Mirrors the login page structure with an extra `prompt: create` parameter passed to the authentication request.             |
| Callback | `src/pages/callback.page.vue` | Handles the identity provider's redirect response. Routes to the login page when a `session_id` is present, otherwise completes the standard authorization flow.   |
| Entry    | `src/pages/entry.page.vue`    | Entry point for externally-initiated flows (e.g. password reset). Processes the incoming URL and routes to the appropriate next step.                              |
| Profile  | `src/pages/profile.page.vue`  | Protected page showing the authenticated user's session details and token information.                                                                             |
| Revoke   | `src/pages/revoke.page.vue`   | Invalidates the current session tokens without a full logout and returns the user to the home page.                                                                |
| Logout   | `src/pages/logout.page.vue`   | Terminates the user's session and redirects to the home page after logout.                                                                                         |

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This example app is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
