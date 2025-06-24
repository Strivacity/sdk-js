# @strivacity/sdk-nuxt

> **The SDK supports Nuxt version 3 and above**

### Install

```bash
npm install @strivacity/sdk-nuxt
```

### Usage

#### Add this to your nuxt config file:

```js
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	...
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		mode: 'redirect', // or 'popup' or 'native'
		issuer: 'https://<YOUR_DOMAIN>',
		scopes: ['openid', 'profile'],
		clientId: '<YOUR_CLIENT_ID>',
		redirectUri: '<YOUR_REDIRECT_URI>',
	},
});
```

#### How to use the SDK in your components:

##### Redirect or popup mode

When using redirect or popup mode, the authentication flow involves two main components: a login page that initiates the authentication process, and a callback page that handles the response from the identity provider.

In **redirect mode**, users are redirected to the identity provider's login page in the same browser window. After successful authentication, they are redirected back to your application's callback URL.

In **popup mode**, the authentication happens in a popup window, allowing the main application to remain open while the user authenticates.

###### Login page example

The login page is where users start the authentication process. This component automatically triggers the login flow when the page loads, redirecting users to the identity provider for authentication.

```vue
<script setup>
const { login } = useStrivacity();

onMounted(() => {
	login();
});
</script>

<template>
	<section>
		<h1>Redirecting...</h1>
	</section>
</template>
```

###### Callback page example

The callback page handles the response from the identity provider after successful authentication. It processes the authentication result, extracts the tokens, and redirects users to their intended destination (typically a protected page like a profile or dashboard).

```vue
<script setup>
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

<template>
	<section>
		<h1>Logging in...</h1>
	</section>
</template>
```

###### Profile page example

The profile page displays user information and authentication details after successful login. It uses the `useStrivacity` composable to access the authentication state and display relevant data such as access tokens, ID token claims, and expiration status.

We check if the user is authenticated and display their profile information. If the user is not authenticated, we redirect them to the login page.

```vue
<script setup>
const { loading, isAuthenticated, accessToken, accessTokenExpired, accessTokenExpirationDate, idTokenClaims, refreshToken } = useStrivacity();
</script>

<template>
	<section>
		<h1 v-if="loading">Loading...</h1>
		<dl v-else>
			<dt>
				<strong>accessToken</strong>
			</dt>
			<dd>
				<pre>{{ JSON.stringify(accessToken) }}</pre>
			</dd>
			<dt>
				<strong>refreshToken</strong>
			</dt>
			<dd>
				<pre>{{ JSON.stringify(refreshToken) }}</pre>
			</dd>
			<dt>
				<strong>accessTokenExpired</strong>
			</dt>
			<dd>
				<pre>{{ JSON.stringify(accessTokenExpired) }}</pre>
			</dd>
			<dt>
				<strong>accessTokenExpirationDate</strong>
			</dt>
			<dd>
				<pre>{{ accessTokenExpirationDate ? new Date(accessTokenExpirationDate * 1000).toLocaleString() : JSON.stringify(null) }}</pre>
			</dd>
			<dt>
				<strong>claims</strong>
			</dt>
			<dd>
				<pre>{{ JSON.stringify(idTokenClaims, null, 2) }}</pre>
			</dd>
		</dl>
	</section>
</template>
```

###### Logout page example

The logout page handles user logout by terminating their session. The `postLogoutRedirectUri` parameter is optional and specifies where users should be redirected after logout. If not provided, users will be redirected to the identity provider's logout page.

This URI must be configured in the Admin Console as an allowed post-logout redirect URI for your application.

```vue
<script setup>
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

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
```

###### Component example

Here's a simple component example that demonstrates how to use the SDK in a component with login/logout functionality:

```vue
<script setup>
const { isAuthenticated, idTokenClaims, login, logout } = useStrivacity();
const name = computed(() => `${idTokenClaims.value?.given_name} ${idTokenClaims.value?.family_name}`);
</script>

<template>
	<div v-if="isAuthenticated">
		<div>Welcome, {{ name }}!</div>
		<button @click="logout()">Logout</button>
	</div>
	<div v-else>
		<div>Not logged in</div>
		<button @click="login()">Log in</button>
	</div>
</template>
```

##### Native mode

If you are using `native` mode, you can use the `StyLoginRenderer` component to render the login UI.

To customize the UI components used in the authentication flows, define the `widgets` object in your component.

###### Example widgets

The example widgets use SCSS for styling and Luxon for date handling. You'll need to install these dependencies:

```bash
npm install sass luxon
npm install --save-dev @types/luxon
```

```js
import CheckboxWidget from './checkbox.widget.vue';
import DateWidget from './date.widget.vue';
import InputWidget from './input.widget.vue';
import LayoutWidget from './layout.widget.vue';
import MultiSelectWidget from './multiselect.widget.vue';
import PasscodeWidget from './passcode.widget.vue';
import LoadingWidget from './loading.widget.vue';
import PasswordWidget from './password.widget.vue';
import PhoneWidget from './phone.widget.vue';
import SelectWidget from './select.widget.vue';
import StaticWidget from './static.widget.vue';
import SubmitWidget from './submit.widget.vue';

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

You can find example widgets here: [Example widgets](https://github.com/Strivacity/sdk-js/tree/main/apps/vue/src/components/widgets)

###### Login page example

The native mode login page provides a fully customizable authentication experience rendered directly within your application. Unlike redirect or popup modes, native mode keeps users on your site throughout the entire authentication process using the `StyLoginRenderer` component.

This example demonstrates how to handle session management, implement callback functions for various authentication events, and manage URL parameters for session continuity.

```vue
<script setup lang="ts">
import { FallbackError, useStrivacity, type LoginFlowState } from '@strivacity/sdk-nuxt';
import { widgets } from './components/widgets'; // Import your custom widgets

const router = useRouter();
const { options, login } = useStrivacity();
const sessionId = ref<string | null>(null);

/**
 * Extract session_id from URL parameters and clean up the URL
 * This is necessary for maintaining session state across external login providers
 */
onMounted(() => {
	if (process.client && window.location.search !== '') {
		const url = new URL(window.location.href);
		const sid = url.searchParams.get('session_id');
		sessionId.value = sid;
		url.search = '';
		window.history.replaceState({}, '', url.toString());
	}
});

/**
 * Called when authentication is successful
 * Redirects user to the profile page
 */
const onLogin = async () => {
	await router.push('/profile');
};

/**
 * Called when native flow cannot handle the authentication
 * Falls back to redirect mode by navigating to the provided URL
 * @param error - FallbackError containing the fallback URL and message
 */
const onFallback = (error: FallbackError) => {
	if (error.url) {
		console.log(`Fallback: ${error.url}`);
		if (process.client) {
			window.location.href = error.url.toString();
		}
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

<template>
	<StyLoginRenderer
		:widgets="widgets"
		:session-id="sessionId"
		@fallback="onFallback"
		@login="onLogin"
		@error="onError"
		@global-message="onGlobalMessage"
		@block-ready="onBlockReady"
	/>
</template>
```

###### Callback page example

The native mode callback page handles authentication responses when external identity providers redirect back to your application. This page checks for session IDs in the URL parameters and either continues the native flow or falls back to standard callback handling.

This component is essential for handling social login providers (like Google, Facebook, etc.) that require redirect-based authentication even within native mode flows.

```vue
<script setup>
const query = computed(() => (process.client ? Object.fromEntries(new URLSearchParams(window.location.search)) : {}));
const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
	if (process.client) {
		const url = new URL(location.href);
		const sessionId = url.searchParams.get('session_id');

		if (sessionId) {
			await router.push(`/login?session_id=${sessionId}`);
		} else {
			try {
				await handleCallback();
				await router.push('/profile');
			} catch (error) {
				console.error('Error during callback handling:', error);
			}
		}
	}
});
</script>

<template>
	<section v-if="query.error">
		<h1>Error in authentication</h1>
		<div>
			<h4>{{ query.error }}</h4>
			<p>{{ query.error_description }}</p>
		</div>
	</section>
	<section v-else>
		<h1>Logging in...</h1>
	</section>
</template>
```

###### Profile page example

Same as the profile page example in redirect/popup mode.

###### Logout page example

Same as the logout page example in redirect/popup mode.

### API Documentation

#### `useStrivacity` composable

```typescript
useStrivacity<T extends PopupContext | RedirectContext | NativeContext>(): T;
```

You can choose between `PopupContext`, `RedirectContext`, or `NativeContext` using the `mode` option when configuring the SDK.

**Properties**

- **`sdk: RedirectFlow | PopupFlow | NativeFlow`**: Returns the SDK instance based on the configured mode.
- **`loading: Ref<boolean>`**: Indicates if the session is being loaded.
- **`options: SDKOptions`**: The configured options for the SDK.
- **`isAuthenticated: Ref<boolean>`**: Indicates whether the user is authenticated.
- **`idTokenClaims: Ref<IdTokenClaims | null>`**: Claims from the ID token, or null if not available.
- **`accessToken: Ref<string | null>`**: The access token, or null if not available.
- **`refreshToken: Ref<string | null>`**: The refresh token, or null if not available.
- **`accessTokenExpired: Ref<boolean>`**: Indicates if the access token has expired.
- **`accessTokenExpirationDate: Ref<number | null>`**: Expiration date of the access token, or null if not set.

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

#### `StyLoginRenderer` component

The `StyLoginRenderer` component is used in native mode to render the authentication UI directly within your application. It provides a fully customizable login experience using your own UI components.

```typescript
StyLoginRenderer: Vue.Component<{
	params?: NativeParams;
	widgets?: PartialRecord<WidgetType, Vue.Component>;
	sessionId?: string | null;
	onLogin?: (claims?: IdTokenClaims | null) => void;
	onFallback?: (error: FallbackError) => void;
	onError?: (error: any) => void;
	onGlobalMessage?: (message: string) => void;
	onBlockReady?: ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => void;
}>;
```

**Properties**

- **`params?: NativeParams`** (optional): Additional parameters to pass to the native login flow. These parameters can include custom configuration options for the authentication process.

- **`widgets?: PartialRecord<WidgetType, Vue.Component>`** (optional): A collection of Vue components that define the UI widgets used in the authentication flow. Each widget type (input, button, layout, etc.) can be customized with your own components.

- **`sessionId?: string | null`** (optional): The session ID for continuing an existing authentication session. This is typically extracted from URL parameters when returning from external identity providers.

**Events**

- **`@login?: (claims?: IdTokenClaims | null) => void`** (optional): Event emitted when authentication is successful. Receives the ID token claims as a parameter.

- **`@fallback?: (error: FallbackError) => void`** (optional): Event emitted when the native flow cannot handle the authentication and needs to fall back to redirect mode. The error parameter contains the fallback URL.

- **`@error?: (error: any) => void`** (optional): Event emitted when an error occurs during the authentication process. Use this to handle and display error messages to users.

- **`@global-message?: (message: string) => void`** (optional): Event emitted when the authentication flow wants to display a global message to the user (e.g., account lockout warnings, validation messages).

- **`@block-ready?: ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => void`** (optional): Event emitted when the authentication flow transitions between states. Useful for tracking progress, implementing custom logging, or injecting analytics. Receives both the previous and current flow states.

**Widget Types**

The `widgets` prop accepts the following widget types:

- `checkbox`: For checkbox input fields
- `date`: For date input fields
- `input`: For text input fields
- `layout`: For layout containers and form structure
- `loading`: For loading indicators
- `multiSelect`: For multi-select dropdown fields
- `passcode`: For passcode input fields
- `password`: For password input fields
- `phone`: For phone number input fields
- `select`: For single-select dropdown fields
- `static`: For static text and display elements
- `submit`: For form submission buttons

Each widget component receives props specific to its type and function within the authentication flow.

### Links

[Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/nuxt)
