# Strivacity SDK - Nuxt Example App

This example application demonstrates how to integrate the [@strivacity/sdk-nuxt](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-nuxt) SDK into a Nuxt 3 application using the Nuxt module system. It covers all supported authentication modes (`redirect`, `popup`, `native`, `embedded`) and shows how to structure page-based authentication flows.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

The SDK is registered as a Nuxt module in `nuxt.config.ts` and exposes the `useStrivacity` composable, which is auto-imported across all pages and components. Vue Router (built into Nuxt) is used for client-side navigation with route middleware for authentication guards.

## Requirements

- Nuxt: 3+
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
pnpm app:nuxt:serve
```

## Usage

### Initialization

The SDK is configured as a Nuxt module in `nuxt.config.ts` under the `strivacity` key. The app runs client-side only (`ssr: false`). The root layout in `app/app.vue` dynamically imports `bundle.js` from the configured issuer domain, which registers the Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`, etc.) used in `embedded` mode:

```typescript
// nuxt.config.ts
import { DefaultLogging } from '@strivacity/sdk-core/utils/Logging';

export default defineNuxtConfig({
	ssr: false,
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		mode: process.env.VITE_MODE as 'redirect' | 'popup' | 'native',
		issuer: process.env.VITE_ISSUER,
		scopes: process.env.VITE_SCOPES?.split(' '),
		clientId: process.env.VITE_CLIENT_ID,
		redirectUri: process.env.VITE_REDIRECT_URI,
		storageTokenName: 'sty.session.nuxt',
		logging: DefaultLogging,
	},
});
```

The `useStrivacity` composable is auto-imported in all pages and components without any explicit import statement. It returns reactive refs for `loading`, `isAuthenticated`, `idTokenClaims`, `sdk`, and the authentication methods:

```vue
<script lang="ts" setup>
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

`app/pages/login.vue` and `app/pages/register.vue` initiate the authentication flow. The active mode determines how the UI is rendered:

- **`redirect`** — `login()` is called on mount; the user is taken to the identity provider in the same window.
- **`popup`** — `login()` is called on mount; authentication happens in a popup window.
- **`native`** — The `StyLoginRenderer` component renders the login UI inline using your custom widget components.
- **`embedded`** — The `<sty-login>` web component (loaded via `bundle.js` from the cluster) takes over rendering.

`app/pages/callback.vue` handles the response from the identity provider. It calls `handleCallback()` and redirects to `/profile` on success:

```vue
<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
	const url = new URL(location.href);

	if (url.searchParams.has('session_id')) {
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

### Refresh token

Token refresh runs automatically when the SDK detects an expired access token. The `refresh` method is also available via the composable for manual invocation:

```vue
<script lang="ts" setup>
const { refresh } = useStrivacity();
</script>
```

### Revoke session / logout

`app/pages/revoke.vue` revokes the current session tokens without a full logout. It checks `isAuthenticated` before calling `revoke()` and then returns to the home page:

```vue
<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

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

`app/pages/logout.vue` performs a full logout. When the user is authenticated, `logout()` is called with `postLogoutRedirectUri` set to the application origin; otherwise the user is immediately redirected home:

```vue
<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

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

`app/pages/entry.vue` handles flows started by an external process (e.g. password reset, magic link, invite). On mount it calls `entry()`, which processes the incoming URL and returns a `session_id` (and optionally a `short_app_id`). These are forwarded as query parameters to `/callback` to resume the flow; if no data is returned the user is redirected to the home page:

```vue
<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

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

The callback page detects the `session_id` parameter and forwards it to `/login` to continue the native or embedded flow, instead of running the standard `handleCallback()` path.

The login page extracts `session_id` and `short_app_id` from the URL on load, cleans up the URL, and passes them to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new login.

You can also navigate directly to `/login?session_id=<id>` to resume a flow without going through the entry page, which is useful when the `session_id` is obtained through your own backend logic.

## Logging

Enable the built-in console logger by passing `logging: DefaultLogging` to the SDK options:

```typescript
import { DefaultLogging } from '@strivacity/sdk-nuxt';

// ...within your SDK options:
logging: DefaultLogging,
```

The default logger writes to the browser console and prefixes messages with the `xEventId` correlation ID when available.

To use a custom logger, implement the `SDKLogging` interface and register your class in the SDK options:

```typescript
import type { SDKLogging } from '@strivacity/sdk-nuxt';

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
import { MyLogger } from './logging/MyLogger';

// ...within your SDK options:
logging: MyLogger,
```

## Pages

| Page     | Path                     | Description                                                                                                                                                        |
| -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home     | `app/pages/index.vue`    | Public landing page. Displays user info when authenticated.                                                                                                        |
| Login    | `app/pages/login.vue`    | Entry point for the authentication flow. Accepts optional `session_id` and `short_app_id` URL parameters to resume an existing flow instead of starting a new one. |
| Register | `app/pages/register.vue` | Entry point for the registration flow. Mirrors the login page structure with an extra `prompt: create` parameter passed to the authentication request.             |
| Callback | `app/pages/callback.vue` | Handles the identity provider's redirect response. Routes to the login page when a `session_id` is present, otherwise completes the standard authorization flow.   |
| Entry    | `app/pages/entry.vue`    | Entry point for externally-initiated flows (e.g. password reset). Processes the incoming URL and routes to the appropriate next step.                              |
| Profile  | `app/pages/profile.vue`  | Protected page showing the authenticated user's session details and token information.                                                                             |
| Revoke   | `app/pages/revoke.vue`   | Invalidates the current session tokens without a full logout and returns the user to the home page.                                                                |
| Logout   | `app/pages/logout.vue`   | Terminates the user's session and redirects to the home page after logout.                                                                                         |

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This example app is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
