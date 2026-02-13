# Strivacity SDK for Svelte

Svelte SDK for integrating with Strivacity Identity Platform.

> **The SDK supports Svelte version 4 and above**

## Install

```bash
npm install @strivacity/sdk-svelte
```

## Usage

This SDK supports three authentication modes: **redirect** (default), **popup**, and **native**. Each mode provides a different user experience for authentication flows.

### Adding the SDK to your main Svelte application

Wrap your application with the `StyAuthProvider` component to provide authentication context to all child components:

```svelte
<script lang="ts">
	import { StyAuthProvider, type SDKOptions } from '@strivacity/sdk-svelte';
	import Router from './Router.svelte';

	const options: SDKOptions = {
		mode: 'redirect', // or 'popup' or 'native'
		issuer: 'https://<YOUR_DOMAIN>',
		scopes: ['openid', 'profile'],
		clientId: '<YOUR_CLIENT_ID>',
		redirectUri: '<YOUR_REDIRECT_URI>',
	};
</script>

<StyAuthProvider {options}>
	<Router />
</StyAuthProvider>
```

## Redirect mode (default)

In redirect mode, users are redirected to the identity provider's login page and then back to your application after authentication.

##### Login page example

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity, type RedirectContext } from '@strivacity/sdk-svelte';

	const { login } = useStrivacity<RedirectContext>();

	onMount(() => {
		login();
	});
</script>
```

##### Callback page example

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useStrivacity, type RedirectContext } from '@strivacity/sdk-svelte';

	const { handleCallback } = useStrivacity<RedirectContext>();

	onMount(async () => {
		try {
			await handleCallback();
			await goto('/profile');
		} catch (error) {
			console.error('Error during callback handling:', error);
		}
	});
</script>

<h1>Logging in...</h1>
```

##### Profile page example

```svelte
<script lang="ts">
	import { useStrivacity, type RedirectContext } from '@strivacity/sdk-svelte';
	import { goto } from '$app/navigation';

	const { isAuthenticated, idTokenClaims, logout } = useStrivacity<RedirectContext>();

	async function handleLogout() {
		await logout();
	}
</script>

{#if $isAuthenticated}
	<h1>Welcome, {$idTokenClaims?.name || 'User'}</h1>
	<button onclick={handleLogout}>Logout</button>
{:else}
	<p>Not authenticated</p>
{/if}
```

##### Logout page example

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity, type RedirectContext } from '@strivacity/sdk-svelte';

	const { logout } = useStrivacity<RedirectContext>();

	onMount(() => {
		logout();
	});
</script>

<h1>Logging out...</h1>
```

## Popup mode

In popup mode, authentication happens in a popup window, allowing users to stay on the same page.

##### Login page example

```svelte
<script lang="ts">
	import { useStrivacity, type PopupContext } from '@strivacity/sdk-svelte';
	import { goto } from '$app/navigation';

	const { login } = useStrivacity<PopupContext>();

	async function handleLogin() {
		try {
			await login();
			await goto('/profile');
		} catch (error) {
			console.error('Login error:', error);
		}
	}
</script>

<button onclick={handleLogin}>Login</button>
```

##### Callback page example

Same as the callback page example in redirect mode.

##### Profile page example

Same as the profile page example in redirect mode.

##### Logout page example

Same as the logout page example in redirect mode.

## Native mode

In native mode, authentication UI is rendered directly within your application using customizable widgets. This provides the most seamless user experience.

##### Login page example

```svelte
<script lang="ts">
	import { StyLoginRenderer, useStrivacity, type NativeContext } from '@strivacity/sdk-svelte';
	import { goto } from '$app/navigation';
	import { widgets } from './components/widgets';
	import type { FallbackError, IdTokenClaims, LoginFlowState } from '@strivacity/sdk-svelte';

	const { handleCallback } = useStrivacity<NativeContext>();

	// Extract session_id from URL for continuing flows
	let sessionId = $state<string | null>(null);

	if (typeof window !== 'undefined') {
		const url = new URL(window.location.href);
		sessionId = url.searchParams.get('session_id');
	}

	/**
	 * Called when authentication is successful
	 * @param claims - ID token claims of the authenticated user
	 */
	const onLogin = async (claims?: IdTokenClaims | null) => {
		console.log('Login successful:', claims);
		await goto('/profile');
	};

	/**
	 * Called when native flow cannot handle the authentication
	 * Falls back to redirect mode by navigating to the provided URL
	 * @param error - FallbackError containing the fallback URL and message
	 */
	const onFallback = (error: FallbackError) => {
		if (error.url) {
			console.log(`Fallback: ${error.url}`);
			window.location.href = error.url.toString();
		} else {
			console.error(`FallbackError without URL: ${error.message}`);
			alert(error);
		}
	};

	/**
	 * Called when an error occurs during the authentication process
	 * @param error - Error message describing what went wrong
	 */
	const onError = (error: string) => {
		console.error(`Error: ${error}`);
		alert(error);
	};

	/**
	 * Called when the authentication flow wants to display a global message
	 * @param message - Message to display to the user
	 */
	const onGlobalMessage = (message: string) => {
		alert(message);
	};

	/**
	 * Called when the authentication flow transitions between states
	 * Useful for tracking flow progress and inject custom logic such as logging or analytics
	 * @param params - Object containing previous and current flow states
	 */
	const onBlockReady = ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => {
		console.log('previousState', previousState);
		console.log('state', state);
	};
</script>

<StyLoginRenderer
	{widgets}
	{sessionId}
	onlogin={onLogin}
	onfallback={onFallback}
	onerror={onError}
	onglobalmessage={onGlobalMessage}
	onblockready={onBlockReady}
/>
```

##### Callback page example

The native mode callback page handles authentication responses when external identity providers redirect back to your application. This page checks for session IDs in the URL parameters and either continues the native flow or falls back to standard callback handling.

This component is essential for handling social login providers (like Google, Facebook, etc.) that require redirect-based authentication even within native mode flows.

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useStrivacity, type NativeContext } from '@strivacity/sdk-svelte';

	const { handleCallback } = useStrivacity<NativeContext>();

	let query = $state<Record<string, string>>({});

	if (typeof window !== 'undefined') {
		query = Object.fromEntries(new URLSearchParams(window.location.search));
	}

	onMount(async () => {
		const url = new URL(location.href);
		const sessionId = url.searchParams.get('session_id');

		if (sessionId) {
			await goto(`/login?session_id=${sessionId}`);
		} else {
			try {
				await handleCallback();
				await goto('/profile');
			} catch (error) {
				console.error('Error during callback handling:', error);
			}
		}
	});
</script>

{#if query.error}
	<section>
		<h1>Error in authentication</h1>
		<div>
			<h4>{query.error}</h4>
			<p>{query.error_description}</p>
		</div>
	</section>
{:else}
	<section>
		<h1>Logging in...</h1>
	</section>
{/if}
```

##### Profile page example

Same as the profile page example in redirect/popup mode.

##### Logout page example

Same as the logout page example in redirect/popup mode.

## Logging

The SDK supports optional logging to help you debug authentication flows and monitor SDK behavior. You can enable the built-in console logger or provide your own custom logger implementation.

### Using the Default Logger

Enable the default console logger by adding the `logging` option when creating the SDK:

```svelte
<script lang="ts">
	import { StyAuthProvider, DefaultLogging, type SDKOptions } from '@strivacity/sdk-svelte';
	import Router from './Router.svelte';

	const options: SDKOptions = {
		mode: 'redirect',
		issuer: 'https://<YOUR_DOMAIN>',
		scopes: ['openid', 'profile'],
		clientId: '<YOUR_CLIENT_ID>',
		redirectUri: '<YOUR_REDIRECT_URI>',
		logging: DefaultLogging, // Enable built-in console logging
	};
</script>

<StyAuthProvider {options}>
	<Router />
</StyAuthProvider>
```

The default logger writes to the browser console and automatically prefixes messages with a correlation ID when available (via the `xEventId` property).

### Creating a Custom Logger

You can provide your own logger by implementing the `SDKLogging` interface with four methods: `debug`, `info`, `warn`, and `error`. An optional `xEventId` property is honored for log correlation.

```typescript
import type { SDKLogging } from '@strivacity/sdk-svelte';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		// Send to your logging pipeline
		console.debug(this.xEventId ? `[${this.xEventId}] ${message}` : message);
	}

	info(message: string): void {
		console.info(this.xEventId ? `[${this.xEventId}] ${message}` : message);
	}

	warn(message: string): void {
		console.warn(this.xEventId ? `[${this.xEventId}] ${message}` : message);
	}

	error(message: string, error: Error): void {
		console.error(this.xEventId ? `[${this.xEventId}] ${message}` : message, error);
	}
}
```

Then register your custom logger when creating the SDK:

```svelte
<script lang="ts">
	import { StyAuthProvider, type SDKOptions } from '@strivacity/sdk-svelte';
	import { MyLogger } from './logging/MyLogger';
	import Router from './Router.svelte';

	const options: SDKOptions = {
		mode: 'redirect',
		issuer: 'https://<YOUR_DOMAIN>',
		scopes: ['openid', 'profile'],
		clientId: '<YOUR_CLIENT_ID>',
		redirectUri: '<YOUR_REDIRECT_URI>',
		logging: MyLogger, // Use your custom logger
	};
</script>

<StyAuthProvider {options}>
	<Router />
</StyAuthProvider>
```

### Logger Interface

The `SDKLogging` interface requires the following methods:

- **`debug(message: string): void`** - Log debug-level messages
- **`info(message: string): void`** - Log informational messages
- **`warn(message: string): void`** - Log warning messages
- **`error(message: string, error: Error): void`** - Log error messages with error objects

The optional `xEventId` property, when set by the SDK, provides a correlation ID to trace related log messages across the authentication flow.

## API Documentation

### `useStrivacity` function

```typescript
useStrivacity<T extends PopupContext | RedirectContext | NativeContext>(): T;
```

You can choose between `PopupContext`, `RedirectContext`, or `NativeContext` using the `mode` option when configuring the SDK.

**Properties**

All properties return Svelte stores that you can subscribe to using the `$` prefix in templates.

- **`sdk: RedirectFlow | PopupFlow | NativeFlow`**: Returns the SDK instance based on the configured mode.
- **`loading: Readable<boolean>`**: Indicates if the session is being loaded.
- **`options: SDKOptions`**: The configured options for the SDK.
- **`isAuthenticated: Readable<boolean>`**: Indicates whether the user is authenticated.
- **`idTokenClaims: Readable<IdTokenClaims | null>`**: Claims from the ID token, or null if not available.
- **`accessToken: Readable<string | null>`**: The access token, or null if not available.
- **`refreshToken: Readable<string | null>`**: The refresh token, or null if not available.
- **`accessTokenExpired: Readable<boolean>`**: Indicates if the access token has expired.
- **`accessTokenExpirationDate: Readable<number | null>`**: Expiration date of the access token, or null if not set.

---

**Type: `RedirectContext`**

Represents the available methods for redirect-based interactions.

- **`login(options?: LoginOptions): Promise<void>`**: Initiates the login process by redirecting the user to the identity provider.
  - `options` (optional): Configuration options for login.
- **`register(options?: RegisterOptions): Promise<void>`**: Registers a new user using a redirect flow.
  - `options` (optional): Configuration options for registration.
- **`refresh(): Promise<void>`**: Refreshes the user's session using a redirect flow.
- **`revoke(): Promise<void>`**: Revokes the current session tokens using a redirect flow.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs out the user by redirecting to the identity provider.
  - `options` (optional): Configuration options for logout.
- **`handleCallback(url?: string): Promise<void>`**: Handles the callback after a redirect-based authentication or token exchange.
  - `url` (optional): The URL to handle for the callback.

---

**Type: `PopupContext`**

Represents the available methods for popup-based interactions.

- **`login(options?: LoginOptions): Promise<void>`**: Initiates the login process using a popup window.
  - `options` (optional): Configuration options for login.
- **`register(options?: RegisterOptions): Promise<void>`**: Registers a new user using a popup flow.
  - `options` (optional): Configuration options for registration.
- **`refresh(): Promise<void>`**: Refreshes the user's session using a popup.
- **`revoke(): Promise<void>`**: Revokes the current session tokens using a popup flow.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs out the user using a popup window.
  - `options` (optional): Configuration options for logout.
- **`handleCallback(url?: string): Promise<void>`**: Handles the callback after a popup-based authentication or token exchange.
  - `url` (optional): The URL to handle for the callback.

---

**Type: `NativeContext`**

Represents the available methods for native-based interactions.

- **`login(options?: LoginOptions): Promise<NativeFlowHandler>`**: Initiates the login process using a native flow.
  - `options` (optional): Configuration options for login.
- **`register(options?: RegisterOptions): Promise<NativeFlowHandler>`**: Registers a new user using a native flow.
  - `options` (optional): Configuration options for registration.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs out the user by redirecting to the logout page.
  - `options` (optional): Configuration options for logout.
- **`handleCallback(url?: string): Promise<void>`**: Handles the callback after a redirect-based authentication. This will be called automatically by the native flow handler during fallback.
  - `url` (optional): The URL to handle for the callback.

### `StyLoginRenderer` component

The `StyLoginRenderer` component is used in native mode to render the authentication UI directly within your application. It provides a fully customizable login experience using your own UI components.

```typescript
StyLoginRenderer: Svelte.Component<{
	params?: NativeParams;
	widgets?: PartialRecord<WidgetType, Svelte.Component>;
	sessionId?: string | null;
	onlogin?: (claims?: IdTokenClaims | null) => void;
	onfallback?: (error: FallbackError) => void;
	onerror?: (error: any) => void;
	onglobalmessage?: (message: string) => void;
	onblockready?: ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => void;
}>;
```

**Properties**

- **`params?: NativeParams`** (optional): Additional parameters to pass to the native login flow. These parameters can include custom configuration options for the authentication process.

- **`widgets?: PartialRecord<WidgetType, Svelte.Component>`** (optional): A collection of Svelte components that define the UI widgets used in the authentication flow. Each widget type (input, button, layout, etc.) can be customized with your own components.

- **`sessionId?: string | null`** (optional): The session ID for continuing an existing authentication session. This is typically extracted from URL parameters when returning from external identity providers.

**Callback Props**

In Svelte 5, events are replaced with callback props. All callbacks are optional:

- **`onlogin?: (claims?: IdTokenClaims | null) => void`** (optional): Called when authentication is successful. Receives the ID token claims as a parameter.

- **`onfallback?: (error: FallbackError) => void`** (optional): Called when the native flow cannot handle the authentication and needs to fall back to redirect mode. The error parameter contains the fallback URL.

- **`onerror?: (error: any) => void`** (optional): Called when an error occurs during the authentication process. Use this to handle and display error messages to users.

- **`onglobalmessage?: (message: string) => void`** (optional): Called when the authentication flow wants to display a global message to the user (e.g., account lockout warnings, validation messages).

- **`onblockready?: ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => void`** (optional): Called when the authentication flow transitions between states. Useful for tracking progress, implementing custom logging, or injecting analytics. Receives both the previous and current flow states.

**Widget Types**

The `widgets` prop accepts the following widget types:

- `checkbox`: For checkbox input fields
- `close`: For close buttons
- `date`: For date input fields
- `input`: For text input fields
- `layout`: For layout containers and form structure
- `loading`: For loading indicators
- `multiSelect`: For multi-select dropdown fields
- `passcode`: For passcode input fields
- `password`: For password input fields
- `passkeyEnroll`: For passkey enrollment
- `passkeyLogin`: For passkey login
- `phone`: For phone number input fields
- `select`: For single-select dropdown fields
- `static`: For static text and display elements
- `submit`: For form submission buttons
- `webauthnEnroll`: For WebAuthn enrollment
- `webauthnLogin`: For WebAuthn login

Each widget component receives props specific to its type and function within the authentication flow.

## Links

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/svelte)

## Migrating to v3.0

### Entry API Major Changes

Strivacity SDK's `entry()` API now returns a structured object instead of a plain string. To see examples of these changes, check the apps folder in this repository.
