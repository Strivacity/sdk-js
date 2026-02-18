# Strivacity SDK - Ionic Vue Example App

This example application demonstrates how to integrate the Strivacity SDK into an Ionic Vue application with full mobile platform support using Capacitor plugins and native device capabilities.

## Ionic-Specific Enhancements

### Mobile Platform Support with Capacitor

This Ionic Vue application extends the standard Vue implementation with Capacitor plugins for mobile platform support:

#### 1. Additional Dependencies

The Ionic version includes additional Capacitor packages for mobile platform functionality (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-vue": "*",
	"@capacitor/app": "^7.0.1",
	"@capacitor/inappbrowser": "2.2.0",
	"@capacitor/preferences": "^7.0.1"
}
```

These packages provide:

- **@capacitor/app**: App lifecycle and state management for mobile platforms
- **@capacitor/inappbrowser**: In-app browser functionality for authentication flows
- **@capacitor/preferences**: Native storage capabilities for secure token management

#### 2. Enhanced SDK Configuration

The Ionic version includes Capacitor-specific storage and HTTP client implementations (see [src/main.ts](./src/main.ts)):

```typescript
import { Preferences } from '@capacitor/preferences';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { InAppBrowser } from '@capacitor/inappbrowser';

// Custom HTTP client for mobile platforms
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

// Native storage implementation
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
```

#### 2. Platform-Aware SDK Options

The configuration includes platform detection for handling authentication flows differently on web vs mobile:

```typescript
const sdk = createStrivacitySDK({
	// ...other config
	storage: Capacitor.getPlatform() === 'web' ? LocalStorage : CapacitorStorage,
	async urlHandler(url, responseMode) {
		if (Capacitor.getPlatform() === 'web') {
			return redirectUrlHandler(url, responseMode);
		} else {
			await InAppBrowser.openInWebView({ url, options: DefaultWebViewOptions });
		}
	},
	async callbackHandler(url, responseMode) {
		if (Capacitor.getPlatform() !== 'web') {
			// InAppBrowser navigation listener implementation
			return new Promise(async (resolve, reject) => {
				// Mobile-specific callback handling with navigation listeners
			});
		} else {
			return redirectCallbackHandler(url, responseMode);
		}
	},
});
```

### 3. Enhanced Authentication Pages

Both login and register pages include mobile-specific fallback handling:

#### Login Page Enhancements ([src/pages/login.page.vue](./src/pages/login.page.vue)):

```vue
<script lang="ts" setup>
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler } from '@strivacity/sdk-core/utils/handlers';

onMounted(async () => {
	if (sdk.options.mode === 'redirect') {
		await login();

		// Mobile platform token exchange
		if (Capacitor.getPlatform() !== 'web') {
			const params = await sdk.options.callbackHandler!(sdk.options.redirectUri, sdk.options.responseMode || 'fragment');
			await sdk.tokenExchange(params);
			await router.push('/profile');
		}
	}
});

const onFallback = async (error: FallbackError) => {
	if (error.url) {
		if (Capacitor.getPlatform() === 'web') {
			return redirectUrlHandler(error.url.toString());
		} else {
			// InAppBrowser implementation for mobile platforms
			await InAppBrowser.openInWebView({
				url: error.url.toString(),
				options: DefaultWebViewOptions,
			});

			const params = await new Promise<Record<string, string>>(async (resolve, reject) => {
				let navigationListener: PluginListenerHandle | null = null;
				let finishListener: PluginListenerHandle | null = null;
				let userCancelled = true;

				// Navigation event listeners for mobile authentication flow
				navigationListener = await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
					// Handle redirect URI navigation
					if (event.url?.startsWith(sdk.options.redirectUri)) {
						// Extract and process authentication parameters
						userCancelled = false;
						await InAppBrowser.close();
						resolve(params);
					}
				});

				finishListener = await InAppBrowser.addListener('browserClosed', async () => {
					if (userCancelled) {
						reject(new Error('InAppBrowser flow cancelled by user.'));
					}
				});
			});

			// Handle authentication result
			if (params.session_id) {
				await router.push(`/callback?session_id=${params.session_id}`);
			} else {
				await sdk.tokenExchange(params);
				await router.push('/profile');
			}
		}
	}
};
</script>
```

#### Register Page Enhancements ([src/pages/register.page.vue](./src/pages/register.page.vue)):

The register page includes identical mobile platform enhancements with the same InAppBrowser handling and platform detection logic.

### 4. Key Differences from Standard Vue Implementation

| Feature                 | Standard Vue          | Ionic Vue                                                           |
| ----------------------- | --------------------- | ------------------------------------------------------------------- |
| **Storage**             | LocalStorage only     | Platform-aware: LocalStorage (web) / Capacitor Preferences (mobile) |
| **HTTP Client**         | Standard fetch        | Platform-aware: fetch (web) / CapacitorHttp (mobile)                |
| **Authentication Flow** | Web redirects only    | Platform-aware: redirects (web) / InAppBrowser (mobile)             |
| **URL Handling**        | Browser navigation    | Platform-aware: browser (web) / InAppBrowser (mobile)               |
| **Callback Handling**   | URL parameter parsing | Platform-aware: URL parsing (web) / navigation listeners (mobile)   |
| **Session Management**  | Browser-based         | Native device storage integration                                   |

### 5. Mobile Platform Features

- **Native Storage**: Uses Capacitor Preferences API for secure token storage on mobile devices
- **InAppBrowser Integration**: Handles authentication flows within the app context on mobile platforms
- **Platform Detection**: Automatically detects and adapts behavior for web, iOS, and Android platforms
- **Navigation Listeners**: Monitors InAppBrowser navigation events for authentication callback handling
- **User Cancellation Handling**: Properly handles user-initiated authentication flow cancellations
- **Session Management**: Platform-appropriate session handling with native capabilities

## Strivacity SDK - Vue Example App

This example application demonstrates how to integrate the Strivacity SDK into a Vue 3 application using Vue Router for navigation and the Composition API for modern Vue development patterns.

## Key Features and Implementation

### 1. Vue Dependencies

This Vue application uses the Strivacity Vue SDK for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-vue": "*"
}
```

### 2. Plugin-Based Integration

The application uses Vue's plugin system to integrate the Strivacity SDK throughout the application (see [src/main.ts](./src/main.ts)):

```typescript
import { createApp } from 'vue';
import { createStrivacitySDK } from '@strivacity/sdk-vue';

const app = createApp(AppComponent);
const sdk = createStrivacitySDK({
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.vue',
});

app.use(sdk);
app.use(router);
```

### 3. Composition API Integration

The application leverages Vue's Composition API through the `useStrivacity` composable for accessing authentication state (see [src/components/app.component.vue](./src/components/app.component.vue)):

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

### 4. Logging

You can enable SDK logging or plug in your own logger.

- Enable default logging by adding `logging: DefaultLogging` to the SDK options in [src/main.ts](./src/main.ts). The default logger writes to the browser console and automatically prefixes messages with an `xEventId` property when available

```ts
import { createApp } from 'vue';
import { router } from './router';
import { createStrivacitySDK, DefaultLogging } from '@strivacity/sdk-vue';

const app = createApp(AppComponent);
const sdk = createStrivacitySDK({
	// ...other options
	logging: DefaultLogging, // enable built-in console logging
});

app.use(sdk);
app.use(router);
```

- Provide a custom logger by implementing the `SDKLogging` interface (methods: `debug`, `info`, `warn`, `error`). An optional `xEventId` property is honored for log correlation. See the built-in implementation for reference in [packages/sdk-core/src/utils/Logging.ts](../../packages/sdk-core/src/utils/Logging.ts).

```ts
import type { SDKLogging } from '@strivacity/sdk-vue';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		// e.g., send to your logging pipeline
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

Then register your logger class in the SDK options:

```ts
import { createStrivacitySDK } from '@strivacity/sdk-vue';
import { MyLogger } from './logging/MyLogger';

const sdk = createStrivacitySDK({
	// ...other options
	logging: MyLogger,
});
```

### 5. Vue Router Integration

The application uses Vue Router for client-side navigation with route-based authentication guards (see [src/router/index.ts](./src/router/index.ts)):

```typescript
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: '/', component: Home },
		{ path: '/login', component: Login },
		{ path: '/register', component: Register },
		{ path: '/callback', component: Callback },
		{ path: '/profile', component: Profile, meta: { requiresAuth: true } },
		{ path: '/logout', component: Logout, meta: { requiresAuth: true } },
	],
});
```

## Installation and Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables Setup

Create a `.env.local` file in the repository root:

```env
VITE_ISSUER=your-cluster-domain
VITE_CLIENT_ID=your-client-id
VITE_SCOPES=openid profile email
VITE_REDIRECT_URI=http://localhost:3000/callback
VITE_MODE=redirect
```

### 3. Running the Application

```bash
pnpm app:vue:serve
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is integrated as a Vue plugin, providing global access to authentication functionality through the `useStrivacity` composable (see [src/main.ts](./src/main.ts)).

### Component Patterns

Vue components can access authentication state reactively using the Composition API:

```vue
<script setup>
import { useStrivacity } from '@strivacity/sdk-vue';

const { loading, isAuthenticated, idTokenClaims, login, logout } = useStrivacity();
</script>
```

### Pages

Brief, purpose-oriented descriptions of route components under src/pages — what they do, expected behavior, and how they integrate mobile-aware flows (Capacitor / InAppBrowser) via the SDK / composables.

- src/pages/home.page.vue
  - Purpose: Landing / home page. Publicly accessible; introduces the app and links to login/register.
  - Behavior: Displays public content and, when authenticated, brief user info from useStrivacity(). Should be fast and accessible without auth.
  - Usage: const { loading, isAuthenticated, idTokenClaims } = useStrivacity(); use computed refs and v-if for conditional UI.

- src/pages/login.page.vue
  - Purpose: Login page / entry point for authentication flows.
  - Behavior: Triggers sdk.login() (redirect/popup depending on options). On web this usually redirects; on mobile open InAppBrowser and exchange tokens when the callback is received.
  - Usage: onMounted(async () => { await login(); /_ handle mobile token exchange if needed _/ }); use sdk.options.callbackHandler(...) and sdk.tokenExchange(params) for mobile flows.

- src/pages/register.page.vue
  - Purpose: Registration page (if supported).
  - Behavior: Starts a registration flow or shows a form that calls backend/SDK to create a user. Mobile flows use InAppBrowser fallback like login.
  - Usage: call registration API or sdk.register(), then login/redirect as appropriate.

- src/pages/entry.page.vue
  - Purpose: Entry page for link-driven flows (deep links or external links) that start server/SDK-driven operations.
  - Behavior: Calls sdk.entry(); it returns an object `{ session_id: string; short_app_id?: string }`. Forward these as query params using `new URLSearchParams(data)` to `/callback`; otherwise navigate to home. Show loading and error states.
  - Usage: onMounted/async setup: const data = await sdk.entry(); handle returned params and `router.push`.

- src/pages/callback.page.vue
  - Purpose: OAuth / OpenID Connect callback handler — identity provider returns here.
  - Behavior: Reads query params (code, state, session_id) from the router, finalizes authentication via sdk.tokenExchange or sdk.handleCallback, then redirects to the intended route (e.g., /profile).
  - Note: Keep this route unprotected so external providers and InAppBrowser flows can return.
  - Usage: onMounted(async () => { const params = parseQuery(...) ; await sdk.tokenExchange(params); router.push('/profile'); });

- src/pages/profile.page.vue
  - Purpose: Protected user profile page.
  - Behavior: Require authentication (router guard or component-level check). Displays idTokenClaims and other user data from useStrivacity; optionally fetch server data using the session.
  - Usage: const { idTokenClaims, logout } = useStrivacity(); show claims and provide logout button that calls logout().

- src/pages/revoke.page.vue
  - Purpose: Revoke tokens or sessions (optional advanced session management).
  - Behavior: Calls SDK or backend revoke API to invalidate refresh tokens/sessions, surfaces success/error, then logs out or redirects.
  - Usage: await sdk.revoke(params) or call backend, then call logout() / router.push('/') on success.

- src/pages/logout.page.vue
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls sdk.logout(), clears client/native storage (Capacitor Preferences) and redirects to home or login. Implement as an onMounted action that shows progress and navigates away.
  - Usage: onMounted(async () => { await logout(); router.push('/'); });
