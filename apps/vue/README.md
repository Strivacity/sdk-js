# Strivacity SDK - Vue Example App

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

### 4. Vue Router Integration

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

Brief, purpose-oriented descriptions of files under src/pages — what they do, expected behavior, and how they use the Strivacity composable.

- src/pages/index.vue

  - Purpose: Landing/home page. Publicly accessible; introduces the app and often includes links to login/register.
  - Behavior: If the app knows authenticated state, it can display user info (e.g., name) using the useStrivacity composable.
  - Usage: const { loading, isAuthenticated, idTokenClaims } = useStrivacity();

- src/pages/login.vue

  - Purpose: Login page / entry point for the authentication flow.
  - Behavior: Triggers the Strivacity login flow (redirect/popup/native depending on module config). If already authenticated, commonly redirects to the profile page.
  - Tip: Check isAuthenticated and redirect (e.g., to /profile) if true.

- src/pages/register.vue

  - Purpose: Registration page (if registration is supported by your setup).
  - Behavior: Starts a registration flow or presents a registration form and calls the Strivacity backend. Logic is often similar to login but focused on user creation.
  - Usage: useStrivacity().register() or custom UI + SDK calls.

- src/pages/callback.vue

  - Purpose: OAuth / OpenID Connect callback handler — the identity provider returns the user here.
  - Behavior: Receives query params (code, state, etc.), calls the SDK's callback/handleRedirect method, completes authentication, and redirects to the target (e.g., /profile or a previously saved route).
  - Note: Do NOT protect this page with auth middleware because external providers must be able to return here.

- src/pages/profile.vue

  - Purpose: User profile page — intended for authenticated users only.
  - Behavior: Protected route (e.g., definePageMeta({ middleware: 'auth' }) or via global middleware). Displays idTokenClaims and other user data from useStrivacity.
  - Usage: const { idTokenClaims, logout } = useStrivacity(); — for displaying data and signing out.

- src/pages/entry.vue

  - Purpose: Page-level entry component that initiates different operations via links. It is used to start an entry flow (for example when a link or external action should trigger a server-side or SDK-driven operation).
  - Behavior: On mount it calls the composable's entry() method (useStrivacity().entry()). If the call returns a session id the page redirects to /callback with that session_id as a query parameter; otherwise it redirects to the home page. Basic error handling shows a message and redirects to home on failure.
  - Usage: const { entry } = useStrivacity(); — useful for link-driven flows where the entry endpoint decides the next step (redirect to callback or fallback to home).

- src/pages/revoke.vue

  - Purpose: Revoke tokens or user sessions (e.g., revoke refresh tokens or explicit consent) — optional endpoint for advanced session management.
  - Behavior: Calls the SDK or backend revoke endpoint to invalidate tokens and optionally triggers a logout/redirect. Should surface success/error feedback to the user and then redirect (home or login).
  - Usage: Use the SDK's revoke or session-management API (or call your backend) and then use logout/redirect flow; ensure proper UX (loading, error handling).

- src/pages/logout.vue
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls the SDK logout method, clears local session state if needed, and redirects to the home or login page.
  - Tip: This can be a simple "perform logout and redirect" component.
