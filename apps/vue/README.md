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
