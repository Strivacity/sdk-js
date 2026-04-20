# @strivacity/sdk-vue

A Vue 3 plugin that integrates Strivacity's policy-driven authentication journeys into your application using the OAuth 2.0 PKCE flow. Supports `redirect`, `popup`, `native`, and `embedded` modes.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

This SDK allows you to integrate Strivacity's policy-driven journeys into your Vue 3 application. It wraps the `@strivacity/sdk-core` library as a Vue plugin and exposes a `useStrivacity` composable that provides reactive authentication state and methods throughout your application. The SDK uses the OAuth 2.0 PKCE flow to authenticate with Strivacity. For detailed configuration options, available modes, and advanced usage refer to the [`@strivacity/sdk-core` documentation](https://github.com/Strivacity/sdk-js/blob/main/packages/sdk-core/README.md).

## Demo Application

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/vue)
- [Ionic Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/ionic-vue)

## Requirements

- Vue.js: 3+

## Install

```bash
npm install @strivacity/sdk-vue
```

## Usage

### Initialization

Register the SDK as a Vue plugin using `createStrivacitySDK` in your application's entry point:

```js
import { createApp } from 'vue';
import App from './App.vue';
import { createStrivacitySDK } from '@strivacity/sdk-vue';

const app = createApp(App);
const sdk = createStrivacitySDK({
	mode: 'redirect', // or 'popup', 'native', 'embedded'
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
});

app.use(sdk);
app.mount('#app');
```

Use the `useStrivacity` composable in any component to access authentication state:

```vue
<script setup>
import { useStrivacity } from '@strivacity/sdk-vue';

const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
</script>
```

### Redirect / Popup mode

In `redirect` mode the user is taken to the identity provider in the same window; in `popup` mode authentication happens in a popup. Both are initiated the same way from code.

#### Login page example

```vue
<script setup>
import { onMounted } from 'vue';
import { useStrivacity } from '@strivacity/sdk-vue';

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

#### Callback page example

The callback page handles the response from the identity provider. It calls `handleCallback()` and redirects to `/profile` on success:

```vue
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

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

#### Profile page example

```vue
<script setup>
import { useStrivacity } from '@strivacity/sdk-vue';

const { loading, isAuthenticated, accessToken, accessTokenExpired, accessTokenExpirationDate, idTokenClaims, refreshToken } = useStrivacity();
</script>

<template>
	<section>
		<h1 v-if="loading">Loading...</h1>
		<dl v-else>
			<dt><strong>accessToken</strong></dt>
			<dd>
				<pre>{{ JSON.stringify(accessToken) }}</pre>
			</dd>
			<dt><strong>refreshToken</strong></dt>
			<dd>
				<pre>{{ JSON.stringify(refreshToken) }}</pre>
			</dd>
			<dt><strong>accessTokenExpired</strong></dt>
			<dd>
				<pre>{{ JSON.stringify(accessTokenExpired) }}</pre>
			</dd>
			<dt><strong>accessTokenExpirationDate</strong></dt>
			<dd>
				<pre>{{ accessTokenExpirationDate ? new Date(accessTokenExpirationDate * 1000).toLocaleString() : JSON.stringify(null) }}</pre>
			</dd>
			<dt><strong>claims</strong></dt>
			<dd>
				<pre>{{ JSON.stringify(idTokenClaims, null, 2) }}</pre>
			</dd>
		</dl>
	</section>
</template>
```

#### Logout page example

The `postLogoutRedirectUri` parameter is optional and specifies where users are redirected after logout. This URI must be configured in the Admin Console as an allowed post-logout redirect URI.

```vue
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

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

#### Component example

```vue
<script setup>
import { computed } from 'vue';
import { useStrivacity } from '@strivacity/sdk-vue';

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

### Native mode

In `native` mode the `StyLoginRenderer` component renders the authentication UI inline using your custom widget components. You can define custom components for each input type; see [Example widgets](https://github.com/Strivacity/sdk-js/tree/main/apps/vue/src/components/widgets).

The example widgets use SCSS for styling and Luxon for date handling:

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

#### Login page example

The login page extracts `session_id`, `short_app_id`, and optionally `language` from the URL on load, cleans up the URL, and passes them to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new one. When a `language` parameter is present it overrides `uiLocales` to display the authentication UI in the specified language.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { FallbackError, useStrivacity, type LoginFlowState } from '@strivacity/sdk-vue';
import { widgets } from './components/widgets';

const router = useRouter();
const sessionId = ref<string | null>(null);

if (window.location.search !== '') {
	const url = new URL(window.location.href);
	sessionId.value = url.searchParams.get('session_id');
	url.search = '';
	history.replaceState({}, '', url.toString());
}

const onLogin = async () => {
	await router.push('/profile');
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

#### Callback page example

When a `session_id` is present in the URL the native flow is resumed by forwarding it to the login page. Otherwise the standard `handleCallback()` path is used:

```vue
<script setup>
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const query = computed(() => Object.fromEntries(new URLSearchParams(window.location.search)));
const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
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

#### Entry page example

The entry page processes flows started by an external process (e.g. password reset) by calling `entry()` to extract the necessary parameters to resume the flow and forwarding them to the login page:

```vue
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

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
		console.error('Entry failed:', error);
		await router.push('/');
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

```js
import { createApp } from 'vue';
import App from './App.vue';
import { createStrivacitySDK } from '@strivacity/sdk-vue';

void import(`${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);

const app = createApp(App);
const sdk = createStrivacitySDK({
	mode: 'embedded',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
});

app.use(sdk);
app.mount('#app');
```

#### Login page example

The login page extracts `session_id`, `short_app_id`, and optionally `language` from the URL on load and passes them to the `<sty-login>` web component. When a `language` parameter is present it overrides `uiLocales` to display the authentication UI in the specified language. The bundle registers `<sty-login>`, `<sty-notifications>`, and `<sty-language-selector>` as custom elements.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const shortAppId = ref<string | null>(null);
const sessionId = ref<string | null>(null);

if (location.search !== '') {
	const url = new URL(window.location.href);
	shortAppId.value = url.searchParams.get('short_app_id');
	sessionId.value = url.searchParams.get('session_id');
	url.search = '';
	history.replaceState({}, '', url.toString());
}

const onLogin = async () => {
	await router.push('/profile');
};
const onClose = () => {
	location.reload();
};
const onError = (event: CustomEvent) => {
	alert(event.detail);
};
</script>

<template>
	<sty-notifications></sty-notifications>
	<sty-login :shortAppId="shortAppId" :sessionId="sessionId" @close="onClose" @login="onLogin" @error="onError($event.detail)"></sty-login>
	<sty-language-selector></sty-language-selector>
</template>
```

#### Callback page example

Same as the callback page example in native mode.

#### Entry page example

Same as the entry page example in native mode.

#### Profile page example

Same as the profile page example in native mode.

#### Logout page example

Same as the logout page example in native mode.

## Logging

The SDK supports optional logging to help you debug authentication flows and monitor SDK behavior. You can enable the built-in console logger or provide your own custom logger implementation.

### Using the Default Logger

Enable the default console logger by adding the `logging` option when creating the SDK:

```js
import { createStrivacitySDK, DefaultLogging } from '@strivacity/sdk-vue';

const sdk = createStrivacitySDK({
	mode: 'redirect',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
	logging: DefaultLogging,
});
```

The default logger writes to the browser console and automatically prefixes messages with a correlation ID when available (via the `xEventId` property).

### Creating a Custom Logger

Implement the `SDKLogging` interface and pass your class to the `logging` option:

```typescript
import type { SDKLogging } from '@strivacity/sdk-vue';

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

```js
import { createStrivacitySDK } from '@strivacity/sdk-vue';
import { MyLogger } from './logging/MyLogger';

const sdk = createStrivacitySDK({
	// ...other options
	logging: MyLogger,
});
```

The `SDKLogging` interface requires `debug`, `info`, `warn`, and `error` methods. The optional `xEventId` property, when set by the SDK, provides a correlation ID to trace related log messages across the authentication flow.

## API Documentation

### `useStrivacity` composable

```typescript
useStrivacity<T extends PopupContext | RedirectContext | NativeContext>(): T;
```

The composable returns a different context type depending on the `mode` configured when creating the SDK.

**Shared properties (all modes)**

- **`sdk: RedirectFlow | PopupFlow | NativeFlow`**: The underlying SDK flow instance.
- **`loading: Ref<boolean>`**: `true` while the session is being initialized.
- **`options: SDKOptions`**: The configured SDK options.
- **`isAuthenticated: Ref<boolean>`**: `true` when the user has a valid session.
- **`idTokenClaims: Ref<IdTokenClaims | null>`**: Claims from the ID token, or `null` if not authenticated.
- **`accessToken: Ref<string | null>`**: The current access token.
- **`refreshToken: Ref<string | null>`**: The current refresh token.
- **`accessTokenExpired: Ref<boolean>`**: `true` when the access token has expired.
- **`accessTokenExpirationDate: Ref<number | null>`**: Expiration timestamp (Unix ms) of the access token.

---

**Type: `RedirectContext`**

- **`login(options?: LoginOptions): Promise<void>`**: Initiates login by redirecting to the identity provider.
- **`register(options?: RegisterOptions): Promise<void>`**: Initiates registration using a redirect flow.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via redirect.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback after redirect.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL and returns the parameters needed to resume the flow (e.g. `session_id`, `short_app_id`).

---

**Type: `PopupContext`**

- **`login(options?: LoginOptions): Promise<void>`**: Initiates login using a popup window.
- **`register(options?: RegisterOptions): Promise<void>`**: Initiates registration using a popup.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via popup.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL and returns the parameters needed to resume the flow.

---

**Type: `NativeContext`**

- **`login(options?: LoginOptions): Promise<NativeFlowHandler>`**: Initiates login using the native flow.
- **`register(options?: RegisterOptions): Promise<NativeFlowHandler>`**: Initiates registration using the native flow.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via redirect.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL and returns the parameters needed to resume the flow.

---

### `StyLoginRenderer` component

Used in `native` mode to render the authentication UI with your own widget components.

**Props**

- **`params?: NativeParams`**: Additional parameters for the native login flow.
- **`widgets?: PartialRecord<WidgetType, Vue.Component>`**: Custom Vue components for each widget type used in the flow.
- **`sessionId?: string | null`**: Session ID for resuming an existing authentication session. Typically extracted from URL parameters when returning from an external identity provider.

**Events**

- **`@login`**: Emitted on successful authentication. Receives `IdTokenClaims | null`.
- **`@fallback`**: Emitted when the native flow needs to fall back to redirect. Receives `FallbackError` with a fallback URL.
- **`@error`**: Emitted when an error occurs during authentication.
- **`@global-message`**: Emitted when the flow wants to display a global message (e.g. account lockout warning).
- **`@block-ready`**: Emitted on flow state transitions. Receives `{ previousState: LoginFlowState; state: LoginFlowState }`. Useful for analytics and custom logging.

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

@strivacity/sdk-vue is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).

## Migrating to v3.0

### Entry API Major Changes

Strivacity SDK's `entry()` API now returns a structured object instead of a plain string. Check the example above in the usage section for more details.
