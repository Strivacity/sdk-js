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

### 4. File-Based Routing

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

### 5. Route Protection Middleware

The application implements Nuxt middleware for protecting authenticated routes (see [middleware/auth.ts](./middleware/auth.ts)):

```typescript
export default defineNuxtRouteMiddleware(() => {
	const { isAuthenticated } = useStrivacity();

	if (!isAuthenticated.value) {
		return navigateTo('/login');
	}
});
```

### 6. Page Meta Configuration

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
