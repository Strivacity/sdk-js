# Strivacity SDK - Nuxt Example App

This example application demonstrates how to integrate the Strivacity SDK into a Nuxt 3 application using the official Nuxt module for seamless authentication integration with server-side rendering capabilities.

## Key Features and Implementation

### 1. Nuxt Dependencies

This Nuxt application uses the Strivacity Nuxt SDK module for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-nuxt": "*"
}
```

### 2. Module Configuration

The application integrates the Strivacity SDK through Nuxt's module system with configuration in `nuxt.config.ts` (see [nuxt.config.ts](./nuxt.config.ts)):

```typescript
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	ssr: false, // Client-side rendering for auth compatibility
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		mode: process.env.VITE_MODE as 'redirect' | 'popup' | 'native',
		issuer: process.env.VITE_ISSUER,
		scopes: process.env.VITE_SCOPES?.split(' '),
		clientId: process.env.VITE_CLIENT_ID,
		redirectUri: process.env.VITE_REDIRECT_URI,
		storageTokenName: 'sty.session.nuxt',
	},
});
```

### 3. Auto-Imported Composables

The Nuxt module automatically provides the `useStrivacity` composable throughout the application (see [app/app.vue](./app/app.vue)):

```vue
<script setup>
// useStrivacity is auto-imported by the Nuxt module
const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
const userName = computed(() => `${idTokenClaims.value?.given_name ?? ''} ${idTokenClaims.value?.family_name ?? ''}`);
</script>

<template>
	<div>
		<div v-if="loading">Loading...</div>
		<div v-else-if="isAuthenticated">Welcome, {{ userName }}!</div>
	</div>
</template>
```

### 4. Logging

You can enable SDK logging or plug in your own logger.

- Enable default logging by adding `logging: DefaultLogging` to the SDK configuration in [nuxt.config.ts](./nuxt.config.ts). The default logger writes to the browser console and automatically prefixes messages with an `xEventId` property when available

```typescript
import { defineNuxtConfig } from 'nuxt/config';
import { DefaultLogging } from '@strivacity/sdk-core';

export default defineNuxtConfig({
	ssr: false,
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		// ...other options
		logging: DefaultLogging, // enable built-in console logging
	},
});
```

- Provide a custom logger by implementing the `SDKLogging` interface (methods: `debug`, `info`, `warn`, `error`). An optional `xEventId` property is honored for log correlation. See the built-in implementation for reference in [packages/sdk-core/src/utils/Logging.ts](../../packages/sdk-core/src/utils/Logging.ts).

```ts
import type { SDKLogging } from '@strivacity/sdk-nuxt';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		// e.g., send to your logging pipeline
		console.log(this.xEventId ? `(${this.xEventId}) ${message}` : message);
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

Then register your logger class in the SDK configuration:

```typescript
import { defineNuxtConfig } from 'nuxt/config';
import { MyLogger } from './logging/MyLogger';

export default defineNuxtConfig({
	ssr: false,
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		// ...other options
		logging: MyLogger,
	},
});
```

### 5. File-Based Routing

The application uses Nuxt's file-based routing with pages for different authentication flows:

```
app/
├── app.vue              # Root layout component
├── pages/
│   ├── index.vue        # Home page
│   ├── login.vue        # Login page
│   ├── register.vue     # Registration page
│   ├── callback.vue     # OAuth callback handler
│   ├── profile.vue      # Protected profile page
│   └── logout.vue       # Logout page
└── middleware/
    └── auth.ts          # Authentication middleware
```

### 6. Route Protection Middleware

The application implements Nuxt middleware for protecting authenticated routes (see [middleware/auth.ts](./middleware/auth.ts)):

```typescript
export default defineNuxtRouteMiddleware(() => {
	const { isAuthenticated } = useStrivacity();

	if (!isAuthenticated.value) {
		return navigateTo('/login');
	}
});
```

### 7. Page Meta Configuration

Pages can define authentication requirements using Nuxt's page meta:

```vue
<script setup>
// Automatically protect this page
definePageMeta({
	middleware: 'auth',
});

const { idTokenClaims } = useStrivacity();
</script>

<template>
	<div>
		<h1>Profile</h1>
		<p>Email: {{ idTokenClaims?.email }}</p>
	</div>
</template>
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
VITE_REDIRECT_URI=http://localhost:4200/callback
VITE_MODE=redirect
```

### 3. Running the Application

#### Development Server

```bash
pnpm app:nuxt:serve
```

#### Production Build

```bash
pnpm run build
pnpm run preview
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is integrated as a Nuxt module, providing automatic configuration and composable auto-imports throughout the application (see [nuxt.config.ts](./nuxt.config.ts)).

### Composable Usage

The `useStrivacity` composable is automatically available in all Vue components without explicit imports:

```vue
<script setup>
// Auto-imported by the Nuxt module
const { loading, isAuthenticated, idTokenClaims, login, logout, register } = useStrivacity();
</script>
```

### Middleware Integration

Authentication logic can be encapsulated in Nuxt middleware for reusable route protection:

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware(() => {
	const { isAuthenticated, loading } = useStrivacity();

	if (loading.value) return;

	if (!isAuthenticated.value) {
		return navigateTo('/login');
	}
});
```

### Pages

Brief, purpose-oriented descriptions of files under app/pages — what they do, expected behavior, and how they use the Strivacity composable.

- app/pages/index.vue
  - Purpose: Landing/home page. Publicly accessible; introduces the app and often includes links to login/register.
  - Behavior: If the app knows authenticated state, it can display user info (e.g., name) using the useStrivacity composable.
  - Usage: const { loading, isAuthenticated, idTokenClaims } = useStrivacity();

- app/pages/login.vue
  - Purpose: Login page / entry point for the authentication flow.
  - Behavior: Triggers the Strivacity login flow (redirect/popup/native depending on module config). If already authenticated, commonly redirects to the profile page.
  - Tip: Check isAuthenticated and redirect (e.g., to /profile) if true.

- app/pages/register.vue
  - Purpose: Registration page (if registration is supported by your setup).
  - Behavior: Starts a registration flow or presents a registration form and calls the Strivacity backend. Logic is often similar to login but focused on user creation.
  - Usage: useStrivacity().register() or custom UI + SDK calls.

- app/pages/callback.vue
  - Purpose: OAuth / OpenID Connect callback handler — the identity provider returns the user here.
  - Behavior: Receives query params (code, state, etc.), calls the SDK's callback/handleRedirect method, completes authentication, and redirects to the target (e.g., /profile or a previously saved route).
  - Note: Do NOT protect this page with auth middleware because external providers must be able to return here.

- app/pages/profile.vue
  - Purpose: User profile page — intended for authenticated users only.
  - Behavior: Protected route (e.g., definePageMeta({ middleware: 'auth' }) or via global middleware). Displays idTokenClaims and other user data from useStrivacity.
  - Usage: const { idTokenClaims, logout } = useStrivacity(); — for displaying data and signing out.

- app/pages/entry.vue
  - Purpose: Page-level entry component that initiates different operations via links. It is used to start an entry flow (for example when a link or external action should trigger a server-side or SDK-driven operation).
  - Behavior: On mount it calls the composable's entry() method (useStrivacity().entry()). If the call returns a session id the page redirects to /callback with that session_id as a query parameter; otherwise it redirects to the home page. Basic error handling shows a message and redirects to home on failure.
  - Usage: const { entry } = useStrivacity(); — useful for link-driven flows where the entry endpoint decides the next step (redirect to callback or fallback to home).

- app/pages/revoke.vue
  - Purpose: Revoke tokens or user sessions (e.g., revoke refresh tokens or explicit consent) — optional endpoint for advanced session management.
  - Behavior: Calls the SDK or backend revoke endpoint to invalidate tokens and optionally triggers a logout/redirect. Should surface success/error feedback to the user and then redirect (home or login).
  - Usage: Use the SDK's revoke or session-management API (or call your backend) and then use logout/redirect flow; ensure proper UX (loading, error handling).

- app/pages/logout.vue
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls the SDK logout method, clears local session state if needed, and redirects to the home or login page.
  - Tip: This can be a simple "perform logout and redirect" component.
