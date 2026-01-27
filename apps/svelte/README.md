# Strivacity Svelte Example App

A comprehensive example application demonstrating the integration and usage of the [@strivacity/sdk-svelte](../../packages/sdk-svelte/README.md) authentication SDK with SvelteKit.

This example showcases all three authentication modes (redirect, popup, and native), with full implementation of custom widgets for native mode flows.

## Key Features and Implementation

### 1. Svelte Dependencies

This Svelte application uses the Strivacity Svelte SDK for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-svelte": "*"
}
```

### 2. Provider-Based Integration

The application uses Svelte's context API through a provider component to integrate the Strivacity SDK throughout the application (see [src/routes/+layout.svelte](./src/routes/+layout.svelte)):

```svelte
<script lang="ts">
	import { StyAuthProvider, type SDKOptions } from '@strivacity/sdk-svelte';

	const options: SDKOptions = {
		mode: import.meta.env.VITE_MODE,
		issuer: import.meta.env.VITE_ISSUER,
		scopes: import.meta.env.VITE_SCOPES.split(' '),
		clientId: import.meta.env.VITE_CLIENT_ID,
		redirectUri: import.meta.env.VITE_REDIRECT_URI,
	};
</script>

<StyAuthProvider {options}>
	<slot />
</StyAuthProvider>
```

### 3. Logging

You can enable SDK logging or plug in your own logger.

- Enable default logging by adding `logging: DefaultLogging` to the SDK options in [src/routes/+layout.svelte](./src/routes/+layout.svelte). The default logger writes to the browser console and automatically prefixes messages with an `xEventId` property when available

```svelte
<script lang="ts">
	import { StyAuthProvider, DefaultLogging, type SDKOptions } from '@strivacity/sdk-svelte';

	const options: SDKOptions = {
		mode: 'redirect',
		issuer: import.meta.env.VITE_ISSUER,
		scopes: import.meta.env.VITE_SCOPES.split(' '),
		clientId: import.meta.env.VITE_CLIENT_ID,
		redirectUri: import.meta.env.VITE_REDIRECT_URI,
		logging: DefaultLogging, // Enable console logging
	};
</script>

<StyAuthProvider {options}>
	<slot />
</StyAuthProvider>
```

- Provide a custom logger by implementing the `SDKLogging` interface (methods: `debug`, `info`, `warn`, `error`). An optional `xEventId` property is honored for log correlation. See the built-in implementation for reference in [packages/sdk-core/src/utils/Logging.ts](../../packages/sdk-core/src/utils/Logging.ts).

```typescript
import type { SDKLogging } from '@strivacity/sdk-svelte';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		// Your custom debug implementation
	}

	info(message: string): void {
		// Your custom info implementation
	}

	warn(message: string): void {
		// Your custom warn implementation
	}

	error(message: string, error: Error): void {
		// e.g., send to your logging pipeline
		console.error(this.xEventId ? `(${this.xEventId}) ${message}` : message, error);
	}
}
```

Then register your logger class in the SDK options:

```svelte
<script lang="ts">
	import { StyAuthProvider, type SDKOptions } from '@strivacity/sdk-svelte';
	import { MyLogger } from './logging/MyLogger';

	const options: SDKOptions = {
		// ...other options
		logging: MyLogger,
	};
</script>

<StyAuthProvider {options}>
	<slot />
</StyAuthProvider>
```

### 4. Runes API Integration

The application leverages Svelte 5's runes for reactivity and the `useStrivacity` function for accessing authentication state (see [src/routes/+page.svelte](./src/routes/+page.svelte)):

```svelte
<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte';

	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	let userName = $derived(`${$idTokenClaims?.given_name ?? ''} ${$idTokenClaims?.family_name ?? ''}`);
</script>

{#if $loading}
	<div>Loading...</div>
{:else if $isAuthenticated}
	<div>Welcome, {userName}!</div>
{/if}
```

### 5. SvelteKit Router

The application uses SvelteKit for client-side navigation with file-based routing (see [src/routes/](./src/routes/)):

```typescript
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

// Routes are defined by the file structure:
// src/routes/+page.svelte        -> /
// src/routes/login/+page.svelte  -> /login
// src/routes/profile/+page.svelte -> /profile

// Programmatic navigation
await goto(resolve('/profile'));
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

```bash
pnpm app:svelte:serve
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is integrated as a provider component, providing global access to authentication functionality through the `useStrivacity` function (see [src/routes/+layout.svelte](./src/routes/+layout.svelte)).

### Component Patterns

Svelte components can access authentication state reactively using the `useStrivacity` function:

```svelte
<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte';

	const { loading, isAuthenticated, idTokenClaims, login, logout } = useStrivacity();
</script>
```

### Pages

Brief, purpose-oriented descriptions of files under src/routes — what they do, expected behavior, and how they use the Strivacity function.

- src/routes/+page.svelte
  - Purpose: Landing/home page. Publicly accessible; introduces the app and often includes links to login/register.
  - Behavior: If the app knows authenticated state, it can display user info (e.g., name) using the useStrivacity function.
  - Usage: const { loading, isAuthenticated, idTokenClaims } = useStrivacity();

- src/routes/login/+page.svelte
  - Purpose: Login page / entry point for the authentication flow.
  - Behavior: Triggers the Strivacity login flow (redirect/popup/native depending on module config). If already authenticated, commonly redirects to the profile page.
  - Tip: Check isAuthenticated and redirect (e.g., to /profile) if true.

- src/routes/register/+page.svelte
  - Purpose: Registration page (if registration is supported by your setup).
  - Behavior: Starts a registration flow or presents a registration form and calls the Strivacity backend. Logic is often similar to login but focused on user creation.
  - Usage: useStrivacity().register() or custom UI + SDK calls.

- src/routes/callback/+page.svelte
  - Purpose: OAuth / OpenID Connect callback handler — the identity provider returns the user here.
  - Behavior: Receives query params (code, state, etc.), calls the SDK's callback/handleRedirect method, completes authentication, and redirects to the target (e.g., /profile or a previously saved route).
  - Note: Do NOT protect this page with auth middleware because external providers must be able to return here.

- src/routes/profile/+page.svelte
  - Purpose: User profile page — intended for authenticated users only.
  - Behavior: Protected route (e.g., definePageMeta({ middleware: 'auth' }) or via global middleware). Displays idTokenClaims and other user data from useStrivacity.
  - Usage: const { idTokenClaims, logout } = useStrivacity(); — for displaying data and signing out.

- src/routes/entry/+page.svelte
  - Purpose: Page-level entry component that initiates different operations via links. It is used to start an entry flow (for example when a link or external action should trigger a server-side or SDK-driven operation).
  - Behavior: On mount it calls the function's entry() method (useStrivacity().entry()). If the call returns a session id the page redirects to /callback with that session_id as a query parameter; otherwise it redirects to the home page. Basic error handling shows a message and redirects to home on failure.
  - Usage: const { entry } = useStrivacity(); — useful for link-driven flows where the entry endpoint decides the next step (redirect to callback or fallback to home).

- src/routes/revoke/+page.svelte
- src/routes/revoke/+page.svelte
  - Purpose: Revoke tokens or user sessions (e.g., revoke refresh tokens or explicit consent) — optional endpoint for advanced session management.
  - Behavior: Calls the SDK or backend revoke endpoint to invalidate tokens and optionally triggers a logout/redirect. Should surface success/error feedback to the user and then redirect (home or login).
  - Usage: Use the SDK's revoke or session-management API (or call your backend) and then use logout/redirect flow; ensure proper UX (loading, error handling).

- src/routes/logout/+page.svelte
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls the SDK logout method, clears local session state if needed, and redirects to the home or login page.
  - Tip: This can be a simple "perform logout and redirect" component.
