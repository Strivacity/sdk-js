# @strivacity/sdk-svelte

A Svelte library that integrates Strivacity's policy-driven authentication journeys into your application using the OAuth 2.0 PKCE flow. Supports `redirect`, `popup`, `native`, and `embedded` modes.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

This SDK allows you to integrate Strivacity's policy-driven journeys into your Svelte application. It wraps the `@strivacity/sdk-core` library as a Svelte context provider and exposes a `useStrivacity` function that provides reactive authentication state and methods throughout your component tree. The SDK uses the OAuth 2.0 PKCE flow to authenticate with Strivacity. For detailed configuration options, available modes, and advanced usage refer to the [`@strivacity/sdk-core` documentation](https://github.com/Strivacity/sdk-js/blob/main/packages/sdk-core/README.md).

## Demo Application

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/svelte)

## Requirements

- Svelte: 5+

## Install

```bash
npm install @strivacity/sdk-svelte
```

## Usage

### Initialization

Wrap your application with `StyAuthProvider` in your root layout:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
import { StyAuthProvider } from '@strivacity/sdk-svelte';

const options = {
	mode: 'redirect', // or 'popup', 'native', 'embedded'
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
};
</script>

<StyAuthProvider {options}>
	<slot />
</StyAuthProvider>
```

Use the `useStrivacity` function in any component to access authentication state:

```svelte
<script>
import { useStrivacity } from '@strivacity/sdk-svelte';

const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
</script>
```

### Redirect / Popup mode

In `redirect` mode the user is taken to the identity provider in the same window; in `popup` mode authentication happens in a popup. Both are initiated the same way from code.

#### Login page example

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
import { onMount } from 'svelte';
import { useStrivacity } from '@strivacity/sdk-svelte';

const { login } = useStrivacity();

onMount(() => {
	login();
});
</script>

<section>
	<h1>Redirecting...</h1>
</section>
```

#### Callback page example

The callback page handles the response from the identity provider. It calls `handleCallback()` and redirects to `/profile` on success:

```svelte
<!-- src/routes/callback/+page.svelte -->
<script>
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { useStrivacity } from '@strivacity/sdk-svelte';

const { handleCallback } = useStrivacity();

onMount(async () => {
	try {
		await handleCallback();
		await goto('/profile');
	} catch (error) {
		console.error('Error during callback handling:', error);
	}
});
</script>

<section>
	<h1>Logging in...</h1>
</section>
```

#### Profile page example

```svelte
<!-- src/routes/profile/+page.svelte -->
<script>
import { useStrivacity } from '@strivacity/sdk-svelte';

const { loading, isAuthenticated, accessToken, accessTokenExpired, accessTokenExpirationDate, idTokenClaims, refreshToken } = useStrivacity();
</script>

<section>
	{#if $loading}
		<h1>Loading...</h1>
	{:else}
		<dl>
			<dt><strong>accessToken</strong></dt>
			<dd><pre>{JSON.stringify($accessToken)}</pre></dd>
			<dt><strong>refreshToken</strong></dt>
			<dd><pre>{JSON.stringify($refreshToken)}</pre></dd>
			<dt><strong>accessTokenExpired</strong></dt>
			<dd><pre>{JSON.stringify($accessTokenExpired)}</pre></dd>
			<dt><strong>accessTokenExpirationDate</strong></dt>
			<dd><pre>{$accessTokenExpirationDate ? new Date($accessTokenExpirationDate * 1000).toLocaleString() : JSON.stringify(null)}</pre></dd>
			<dt><strong>claims</strong></dt>
			<dd><pre>{JSON.stringify($idTokenClaims, null, 2)}</pre></dd>
		</dl>
	{/if}
</section>
```

#### Logout page example

The `postLogoutRedirectUri` parameter is optional and specifies where users are redirected after logout. This URI must be configured in the Admin Console as an allowed post-logout redirect URI.

```svelte
<!-- src/routes/logout/+page.svelte -->
<script>
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { useStrivacity } from '@strivacity/sdk-svelte';

const { isAuthenticated, logout } = useStrivacity();

onMount(async () => {
	if ($isAuthenticated) {
		await logout({ postLogoutRedirectUri: location.origin });
	} else {
		await goto('/');
	}
});
</script>

<section>
	<h1>Logging out...</h1>
</section>
```

#### Component example

```svelte
<script>
import { useStrivacity } from '@strivacity/sdk-svelte';

const { isAuthenticated, idTokenClaims, login, logout } = useStrivacity();

$: name = `${$idTokenClaims?.given_name} ${$idTokenClaims?.family_name}`;
</script>

{#if $isAuthenticated}
	<div>
		<div>Welcome, {name}!</div>
		<button on:click={() => logout()}>Logout</button>
	</div>
{:else}
	<div>
		<div>Not logged in</div>
		<button on:click={() => login()}>Log in</button>
	</div>
{/if}
```

### Native mode

In `native` mode the `StyLoginRenderer` component renders the authentication UI inline using your custom widget components. You can define custom components for each input type; see [Example widgets](https://github.com/Strivacity/sdk-js/tree/main/apps/svelte/src/components/widgets).

The example widgets use SCSS for styling and Luxon for date handling:

```bash
npm install sass luxon
npm install --save-dev @types/luxon
```

```js
import CheckboxWidget from './checkbox.widget.svelte';
import DateWidget from './date.widget.svelte';
import InputWidget from './input.widget.svelte';
import LayoutWidget from './layout.widget.svelte';
import MultiSelectWidget from './multiselect.widget.svelte';
import PasscodeWidget from './passcode.widget.svelte';
import LoadingWidget from './loading.widget.svelte';
import PasswordWidget from './password.widget.svelte';
import PhoneWidget from './phone.widget.svelte';
import SelectWidget from './select.widget.svelte';
import StaticWidget from './static.widget.svelte';
import SubmitWidget from './submit.widget.svelte';

export const widgets = {
	checkbox: CheckboxWidget,
	date: DateWidget,
	input: InputWidget,
	layout: LayoutWidget,
	loading: LoadingWidget,
	passcode: PasscodeWidget,
	password: PasswordWidget,
	phone: PhoneWidget,
	select: SelectWidget,
	multiSelect: MultiSelectWidget,
	static: StaticWidget,
	submit: SubmitWidget,
};
```

#### Login page example

The login page extracts `session_id` from the URL on load, cleans up the URL, and passes it to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new one.

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
import { goto } from '$app/navigation';
import { StyLoginRenderer, type FallbackError, type LoginFlowState } from '@strivacity/sdk-svelte';
import { widgets } from '$lib/components/widgets';

let sessionId: string | null = null;

if (window.location.search !== '') {
	const url = new URL(window.location.href);
	sessionId = url.searchParams.get('session_id');
	url.search = '';
	history.replaceState({}, '', url.toString());
}

const onLogin = async () => {
	await goto('/profile');
};

const onFallback = (error: FallbackError) => {
	if (error.url) {
		window.location.href = error.url.toString();
	} else {
		alert(error);
	}
};

const onError = (error: string) => {
	alert(error);
};

const onGlobalMessage = (message: string) => {
	alert(message);
};

const onBlockReady = ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => {
	console.log('previousState', previousState);
	console.log('state', state);
};
</script>

<StyLoginRenderer
	{widgets}
	{sessionId}
	on:login={onLogin}
	on:fallback={({ detail }) => onFallback(detail)}
	on:error={({ detail }) => onError(detail)}
	on:globalMessage={({ detail }) => onGlobalMessage(detail)}
	on:blockReady={({ detail }) => onBlockReady(detail)}
/>
```

#### Callback page example

When a `session_id` is present in the URL the native flow is resumed by forwarding it to the login page. Otherwise the standard `handleCallback()` path is used:

```svelte
<!-- src/routes/callback/+page.svelte -->
<script>
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { useStrivacity } from '@strivacity/sdk-svelte';

const query = Object.fromEntries(new URLSearchParams(window.location.search));
const { handleCallback } = useStrivacity();

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

#### Entry page example

The entry page processes flows started by an external process (e.g. password reset) by calling `entry()` to extract the necessary parameters to resume the flow and forwarding them to the callback page:

```svelte
<!-- src/routes/entry/+page.svelte -->
<script>
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { useStrivacity } from '@strivacity/sdk-svelte';

const { entry } = useStrivacity();

onMount(async () => {
	try {
		const data = await entry();

		if (data && Object.keys(data).length > 0) {
			await goto(`/callback?${new URLSearchParams(data).toString()}`);
		} else {
			await goto('/');
		}
	} catch (error) {
		console.error('Entry failed:', error);
		await goto('/');
	}
});
</script>
```

#### Profile page example

Same as the profile page example in redirect/popup mode.

#### Logout page example

Same as the logout page example in redirect/popup mode.

### Embedded mode

In `embedded` mode the `<sty-login>` web component (loaded via `bundle.js` from the cluster) handles rendering. Import the bundle at application startup to register the Strivacity web components:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
import { onMount } from 'svelte';
import { StyAuthProvider } from '@strivacity/sdk-svelte';

onMount(() => {
	void import(`${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);
});

const options = {
	mode: 'embedded',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
};
</script>

<StyAuthProvider {options}>
	<slot />
</StyAuthProvider>
```

## Logging

The SDK supports optional logging to help you debug authentication flows and monitor SDK behavior. You can enable the built-in console logger or provide your own custom logger implementation.

### Using the Default Logger

Enable the default console logger by adding the `logging` option:

```svelte
<script>
import { StyAuthProvider, DefaultLogging } from '@strivacity/sdk-svelte';

const options = {
	mode: 'redirect',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
	logging: DefaultLogging,
};
</script>

<StyAuthProvider {options}>
	<slot />
</StyAuthProvider>
```

### Creating a Custom Logger

Implement the `SDKLogging` interface and pass your class to the `logging` option:

```typescript
import type { SDKLogging } from '@strivacity/sdk-svelte';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
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

The `SDKLogging` interface requires `debug`, `info`, `warn`, and `error` methods. The optional `xEventId` property, when set by the SDK, provides a correlation ID to trace related log messages across the authentication flow.

## API Documentation

### `useStrivacity` function

```typescript
useStrivacity<T extends PopupContext | RedirectContext | NativeContext>(): T;
```

The function returns a different context type depending on the `mode` configured in `StyAuthProvider`.

**Shared properties (all modes)**

- **`sdk: RedirectFlow | PopupFlow | NativeFlow`**: The underlying SDK flow instance.
- **`loading: Readable<boolean>`**: `true` while the session is being initialized.
- **`options: SDKOptions`**: The configured SDK options.
- **`isAuthenticated: Readable<boolean>`**: `true` when the user has a valid session.
- **`idTokenClaims: Readable<IdTokenClaims | null>`**: Claims from the ID token, or `null` if not authenticated.
- **`accessToken: Readable<string | null>`**: The current access token.
- **`refreshToken: Readable<string | null>`**: The current refresh token.
- **`accessTokenExpired: Readable<boolean>`**: `true` when the access token has expired.
- **`accessTokenExpirationDate: Readable<number | null>`**: Expiration timestamp (Unix seconds) of the access token.

---

**Type: `RedirectContext`**

- **`login(options?: LoginOptions): Promise<void>`**: Initiates login by redirecting to the identity provider.
- **`register(options?: RegisterOptions): Promise<void>`**: Initiates registration using a redirect flow.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via redirect.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback after redirect.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL and returns the parameters needed to resume the flow.

---

**Type: `PopupContext`**

- **`login(options?: LoginOptions): Promise<void>`**: Initiates login using a popup window.
- **`register(options?: RegisterOptions): Promise<void>`**: Initiates registration using a popup.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via popup.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL.

---

**Type: `NativeContext`**

- **`login(options?: LoginOptions): Promise<NativeFlowHandler>`**: Initiates login using the native flow.
- **`register(options?: RegisterOptions): Promise<NativeFlowHandler>`**: Initiates registration using the native flow.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via redirect.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL.

---

### `StyLoginRenderer` component

Used in `native` mode to render the authentication UI with your own widget components.

**Props**

- **`params?: NativeParams`**: Additional parameters for the native login flow.
- **`widgets?: PartialRecord<WidgetType, SvelteComponent>`**: Custom Svelte components for each widget type used in the flow.
- **`sessionId?: string | null`**: Session ID for resuming an existing authentication session.

**Events**

- **`on:login`**: Dispatched on successful authentication. Receives `IdTokenClaims | null`.
- **`on:fallback`**: Dispatched when the native flow needs to fall back to redirect. Receives `FallbackError` with a fallback URL.
- **`on:error`**: Dispatched when an error occurs during authentication.
- **`on:globalMessage`**: Dispatched when the flow wants to display a global message (e.g. account lockout warning).
- **`on:blockReady`**: Dispatched on flow state transitions. Receives `{ previousState: LoginFlowState; state: LoginFlowState }`. Useful for analytics and custom logging.

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

@strivacity/sdk-svelte is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).

## Migrating to v3.0

### Entry API Major Changes

Strivacity SDK's `entry()` API now returns a structured object instead of a plain string. Check the example above in the usage section for more details.
