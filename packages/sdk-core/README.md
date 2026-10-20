# @strivacity/sdk-core

Framework-agnostic JavaScript/TypeScript SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to any web application with no framework dependencies.

Use it directly in vanilla JS/TS projects or use one of the [framework-specific wrappers](https://docs.strivacity.com/reference/javascript-sdks).

**See also:**
- [Full Documentation](https://docs.strivacity.com/reference/overview) - Complete guide for all authentication modes
- [Example Apps](../../apps/) - Working examples for different frameworks

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Client SDK](#client-sdk)
  - [redirect mode](#client-redirect-mode)
  - [popup mode](#client-popup-mode)
  - [embedded mode](#client-embedded-mode)
  - [native mode](#client-native-mode)
- [Server-side session management](#server-side-session-management)
- [Server SDK](#server-sdk)
  - [Usage](#server-usage)
  - [Storages](#server-storages)
  - [Session helpers](#server-session-helpers)
  - [Back-channel logout](#server-backchannel-logout)
  - [Client authentication](#server-client-authentication)
  - [Configuration Options](#server-configuration-options)
- [Shared features](#shared-features)
  - [Storages](#storages)
  - [SDK events](#sdk-events)
  - [Logging](#logging)
  - [HTTP client](#http-client)
  - [Session state](#session-state)
- [Advanced](#advanced)
  - [Custom flow](#custom-flow)
  - [Error handling](#error-handling)
  - [WebAuthn support](#webauthn-support)
  - [Utility functions](#utility-functions)
- [Configuration reference](#configuration-reference)
  - [Configuration examples](#configuration-examples)
  - [Caching](#caching)
- [Migration guide](#migration-guide)
- [Vulnerability Reporting](#vulnerability-reporting)
- [License](#license)
- [Contributing](#contributing)


---

## Prerequisites

- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-core
```

---

## Choosing a mode

The SDK can be used in **two environments**:
- **[Client SDK](#client-sdk)** - runs in the browser, handles authentication flow directly
- **[Server SDK](#server-sdk)** - runs on your backend, proxies authentication requests to the Strivacity IDP, and manages session state server-side

Both support the same **four authentication modes**:

| Mode       | Login UI                                 | Best for                                     |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `redirect` | Strivacity hosted page                   | Standard web apps                            |
| `popup`    | Strivacity hosted page in a popup        | Web apps that must stay on the current page      |
| `embedded` | Strivacity web components in your page   | Branded login inside your own layout         |
| `native`   | Your own components driven by flow state | Full UI control, step-by-step form rendering |

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where the login UI lives and how the flow state is consumed.

---

## Client SDK

The client SDK (`@strivacity/sdk-core`) runs directly in the browser and handles authentication flows, token management, and session storage client-side.

<a id="client-redirect-mode"></a>
### redirect mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The current browser tab navigates to the Strivacity-hosted login page and back to the configured `redirectUri` after authentication.

```ts
// sdk.ts
import { initFlow } from '@strivacity/sdk-core';

// Default - session loading starts in the background immediately
const sdk = initFlow({
	mode: 'redirect', // authentication mode
	issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
	clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
	redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
	scopes: ['openid', 'profile', 'email'], // requested user permissions/data
});
```

#### Login

Call this to start the login flow. It redirects the user to the Strivacity login page in current browser tab, where they authenticate.

```ts
// login.ts
import { sdk } from './sdk';

await sdk.login({
	// Optional parameters
	loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
	acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
	audiences: ['https://api.example.com'], // target resources for the access token
	resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
	locationMethod: 'assign', // window.location method: 'assign' adds to browser history, 'replace' doesn't (default: 'assign')
	targetWindow: 'self', // 'self' redirects current window, 'top' redirects top-level window (default: 'self')
});
```

#### Handle the callback

Call this on your redirect URI page after the IDP sends the user back. It parses the query parameters from the callback URL, verifies the state matches what was stored during login (CSRF protection), exchanges the authorization code for tokens using PKCE, validates the ID token, and stores the session in the [configured storage](#storages). After that you can redirect to a protected page or render your app.

```ts
// callback.ts
import { sdk } from './sdk';

const { returnTo } = await sdk.handleCallback();
window.location.href = returnTo ?? '/profile';
```

To come back to the page that started the login (for example the one a route guard protected), pass it to `login({ returnTo: '/orders' })`. It must be a path or a URL on the current origin, otherwise `login()` throws. The SDK keeps it with the login state, not in the URL, and `handleCallback()` resolves to it. With `serverSessionUri` it is forwarded to the Server SDK login route, which redirects there after its callback.

> The callback URL is automatically read from `window.location.href` if not provided. You can pass a custom URL as the first parameter: `await sdk.handleCallback(customUrl)`.

#### Registration

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```ts
// register.ts
import { sdk } from './sdk';

await sdk.register({
	// Optional parameters
	loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
	acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
	audiences: ['https://api.example.com'], // target resources for the access token
	resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
	locationMethod: 'assign', // window.location method: 'assign' adds to browser history, 'replace' doesn't (default: 'assign')
	targetWindow: 'self', // 'self' redirects current window, 'top' redirects top-level window (default: 'self')
});
```

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```ts
// logout.ts
import { sdk } from './sdk';

await sdk.logout({
	postLogoutRedirectUri: window.location.origin,
});
```

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

With [server-managed sessions](#logging-out), `logout()` doesn't end the server session - send the browser to your server's logout route instead.

#### Token management

Call these methods to manage the session and access token.

```ts
import { sdk } from './sdk';

// Refresh the access token using the refresh token
// (automatically waits for SDK initialization and session loading)
await sdk.refresh();

// Revoke all tokens at the authorization server and clear the local session
// (automatically waits for SDK initialization and session loading)
await sdk.revoke();

// Get the current access and refresh tokens (synchronous property - ensure SDK is initialized first)
await sdk.init();
const idToken = sdk.idTokenClaims // read-only property - returns the current ID token claims or null if not authenticated
const accessToken = sdk.accessToken; // read-only property - returns the current access token or null if not authenticated
const refreshToken = sdk.refreshToken; // read-only property - returns the current refresh token or null if not authenticated
```

---

<a id="client-popup-mode"></a>
### popup mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The Strivacity login page opens in a separate window or tab. After authentication the opened window or tab closes itself and the parent page receives the session - no full-page navigation required.

```ts
// sdk.ts
import { initFlow } from '@strivacity/sdk-core';

// Default - session loading starts in the background immediately
const sdk = initFlow({
	mode: 'popup', // authentication mode
	issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
	clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
	redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
	scopes: ['openid', 'profile', 'email'], // requested user permissions/data
});
```

#### Login

Call this to start the login flow. It opens a popup window by default with the Strivacity login page, where the user authenticates. After that the popup closes itself and the session is stored in the [configured storage](#storages).

By default a centered popup window opens. Pass `popupWindowTarget` to change where the window opens, and `popupWindowFeatures` to control its size and other window features (`left`/`top` are ignored - the SDK always recalculates them to center the popup over the current window):

```ts
// login.ts
import { sdk } from './sdk';

await sdk.login({
	// Optional parameters
	loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
	acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
	audiences: ['https://api.example.com'], // target resources for the access token
	resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
	popupWindowTarget: '_blank', // any valid browsing context name
	popupWindowFeatures: {
		width: 500,
		height: 700,
		toolbar: false,
		location: false,
		resizable: true,
		scrollbars: true,
	},
});

if (await sdk.isAuthenticated) {
	// User authenticated - navigate to a protected page
	window.location.href = '/profile';
}
```

#### Handle the callback

The pop-up still navigates to your `redirectUri`, so you still need a callback page there - without it nothing posts the result back to the opener. Call `handleCallback()` on that page; in popup mode it never resolves (the opener closes the pop-up once it receives the result), so don't rely on code after it running:

```ts
// callback.ts
import { sdk } from './sdk';

void sdk.handleCallback();
```

`login()` resolves in the opener once the result has been received and, for client-managed sessions, the tokens have been exchanged.

#### Registration

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```ts
// register.ts
import { sdk } from './sdk';

await sdk.register({
	// Optional parameters
	loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
	acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
	audiences: ['https://api.example.com'], // target resources for the access token
	resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
	popupWindowTarget: '_blank', // any valid browsing context name
	popupWindowFeatures: {
		width: 500,
		height: 700,
		toolbar: false,
		location: false,
		resizable: true,
		scrollbars: true,
	},
});

if (await sdk.isAuthenticated) {
	// User authenticated - navigate to a protected page
	window.location.href = '/profile';
}
```

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```ts
// logout.ts
import { sdk } from './sdk';

await sdk.logout({
	postLogoutRedirectUri: window.location.origin,
});
```

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

With [server-managed sessions](#logging-out), `logout()` doesn't end the server session - send the browser to your server's logout route instead.

#### Token management

Call these methods to manage the session and access token.

```ts
import { sdk } from './sdk';

// Refresh the access token using the refresh token
// (automatically waits for SDK initialization and session loading)
await sdk.refresh();

// Revoke all tokens at the authorization server and clear the local session
// (automatically waits for SDK initialization and session loading)
await sdk.revoke();

// Get the current access and refresh tokens (synchronous property - ensure SDK is initialized first)
await sdk.init();
const idToken = sdk.idTokenClaims // read-only property - returns the current ID token claims or null if not authenticated
const accessToken = sdk.accessToken; // read-only property - returns the current access token or null if not authenticated
const refreshToken = sdk.refreshToken; // read-only property - returns the current refresh token or null if not authenticated
```

---

<a id="client-embedded-mode"></a>
### embedded mode

> For details on how this mode works, see the [embedded journey documentation](https://docs.strivacity.com/reference/embedded-journey).

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your Strivacity tenant cluster once during application bootstrap, alongside SDK initialization:

```ts
import { initFlow } from '@strivacity/sdk-core';
import { injectScript } from '@strivacity/sdk-core/utils';

// Load web components bundle
injectScript('sty-components', 'https://<YOUR_TENANT_DOMAIN>/assets/components/bundle.js');

const sdk = initFlow({
	mode: 'embedded', // authentication mode
	issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
	clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
	redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
	scopes: ['openid', 'profile', 'email'], // requested user permissions/data
});
```

#### Login / Register

In embedded mode `sty-login` web component does not take `issuer`, `clientId`, or `redirectUri` as attributes - those come from the SDK configuration above. Place it on your login page together with `sty-notifications` (toast-style system notifications) and `sty-language-selector` (a language switcher for the login flow):

```ts
// login.ts
import { sdk } from './sdk';

// Mount your web components - they drive themselves from here
// <sty-notifications></sty-notifications>
// <sty-login></sty-login>
// <sty-language-selector></sty-language-selector>
```

##### Controlling when the flow starts

By default the login flow starts automatically as soon as `sty-login` connects to the DOM. Add the `lazy` attribute to take manual control, then call `start()` when ready. `start()` accepts an optional params object forwarded to the authorization request, or you can set params via the `params` property before the component mounts:

```ts
// Mount your web component with lazy attribute
// <sty-login id="login" lazy></sty-login>

const login = document.querySelector('sty-login[lazy]');

// Option 1: Start without params (basic usage)
await login.start();

// Option 2: Pass params to start()
await login.start({
	loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
	acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
	audiences: ['https://api.example.com'], // target resources for the access token
	resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
	language: 'en-US', // set the UI language (BCP 47 language tag)
	prompt: 'login', // use 'create' to open the registration flow instead
});

// Option 3: Set params property before calling start()
login.params = {
	loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
	acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
	audiences: ['https://api.example.com'], // target resources for the access token
	resources: ['https://resource.example.com'], // RFC 8707 resource indicators for the access token
	language: 'en-US', // set the UI language (BCP 47 language tag)
	prompt: 'login', // use 'create' to open the registration flow instead
};
await login.start();
```

The web components communicate via custom events:

**Login events:**

The `<sty-login>` element dispatches `login`, `close`, and `error` custom events. Listen to them and react accordingly:

```ts
const login = document.querySelector('sty-login');

login.addEventListener('login', () => {
	// User authenticated - navigate to a protected page
	window.location.href = '/profile';
});

login.addEventListener('close', () => {
	// User cancelled or closed the login flow
	location.reload();
});

login.addEventListener('error', (event) => {
	// A fatal error occurred - the message is available in event.detail
	console.error(event.detail);
});
```

**Notification events:**

The components dispatch `notification` events on the `document` that the `<sty-notifications>` component automatically displays. If you don't want to use `<sty-notifications>`, you can listen to these events and handle them yourself:

```ts
function onNotification(event: CustomEvent) {
	if (event.detail.action === 'show') {
		// Add new notification to your custom notification system
		const notification = event.detail.notification;
		console.log('New notification:', notification);
		// Handle the notification display in your own UI
	} else if (event.detail.action === 'clear') {
		// Clear all notifications
		console.log('Clear all notifications');
	}
}

document.addEventListener('notification', onNotification);

// Don't forget to clean up when unmounting
document.removeEventListener('notification', onNotification);
```

**Dynamic language switching:**

The `<sty-language-selector>` component provides a built-in UI for language switching. If you don't want to use it, you can change the UI language dynamically by updating the `lang` property on the `<sty-login>` component:

```ts
const login = document.querySelector('sty-login');

// Change language programmatically (e.g., from your own language selector)
login.lang = 'fr-FR'; // Switch to French
login.lang = 'de-DE'; // Switch to German
login.lang = 'en-US'; // Switch to English
```

#### Handle the callback

No separate callback page is needed for client-managed sessions. The `<sty-login>` component handles the entire authentication flow automatically, including token exchange, and dispatches a `login` event when authentication completes successfully.

With [server-managed sessions](#server-side-session-management) (`serverSessionUri` set), the SDK instead redirects the browser to your `redirectUri` with `?code=…`, so you need a callback page there that forwards the browser to your server's callback route (e.g. `/auth/callback`).

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing page to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login page**

Forward the parameters as query params to your login page:

```ts
// entry.ts
import { sdk } from './sdk';

const data = await sdk.entry();

// Redirect to login page with flow parameters
const params = new URLSearchParams({
	session_id: data.session_id,
	short_app_id: data.short_app_id,
	language: data.language,
});
window.location.href = `/login?${params}`;
```

Then on your login page, read the parameters and pass them to `sty-login`:

```ts
// login.ts
import { sdk } from './sdk';

// Mount your web component
// <sty-login id="login" lazy></sty-login>

// Read parameters from URL
const params = new URLSearchParams(window.location.search);
const login = document.querySelector('sty-login[lazy]');
login.sessionId = params.get('session_id');
login.shortAppId = params.get('short_app_id');
login.lang = params.get('language') ?? navigator.language;
login.start();

login.addEventListener('login', () => {
	// User authenticated - navigate to a protected page
	window.location.href = '/profile';
});
```

**Option 2: Render login on the entry page**

Pass the parameters directly to `sty-login` on the same page:

```ts
// entry.ts
import { sdk } from './sdk';

const data = await sdk.entry();

// Mount your web component
// <sty-login id="login" lazy></sty-login>

// Set properties on the existing sty-login component
const login = document.querySelector('sty-login[lazy]');
login.sessionId = data.session_id;
login.shortAppId = data.short_app_id;
login.lang = data.language;
login.start();

login.addEventListener('login', () => {
	// User authenticated - navigate to a protected page
	window.location.href = window.location.origin;
});
```

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```ts
// logout.ts
import { sdk } from './sdk';

await sdk.logout({
	postLogoutRedirectUri: window.location.origin,
});
```

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

With [server-managed sessions](#logging-out), `logout()` doesn't end the server session - send the browser to your server's logout route instead.

#### Token management

Call these methods to manage the session and access token.

```ts
import { sdk } from './sdk';

// Refresh the access token using the refresh token
// (automatically waits for SDK initialization and session loading)
await sdk.refresh();

// Revoke all tokens at the authorization server and clear the local session
// (automatically waits for SDK initialization and session loading)
await sdk.revoke();

// Get the current access and refresh tokens (synchronous property - ensure SDK is initialized first)
await sdk.init();
const idToken = sdk.idTokenClaims // read-only property - returns the current ID token claims or null if not authenticated
const accessToken = sdk.accessToken; // read-only property - returns the current access token or null if not authenticated
const refreshToken = sdk.refreshToken; // read-only property - returns the current refresh token or null if not authenticated
```

---

<a id="client-native-mode"></a>
### native mode

> For details on how this mode works, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey).

You build the entire login UI with your own components. Call `startSession()` on the SDK instance to get the initial `NativeFlowState`, render the widgets, submit each form step with `submitForm()`, and repeat until `state.finalizeUrl` is set. When a `submitForm()` (or `startSession()`) response contains `finalizeUrl`, the SDK finalizes the session automatically - you don't need to call `finalizeSession()` yourself.

> [Each example app](https://github.com/Strivacity/sdk-js/tree/main/apps) in this repository includes a framework-specific renderer implementation that you can use as a reference for your own integration.

#### Login / Register

```ts
// login.ts
import { sdk } from './sdk';

const nativeFlowState = await sdk.startSession({
	// Optional parameters
	prompt: 'login', // use 'create' to open the registration flow instead
	language: 'en-US', // set the UI language (BCP 47 language tag)
	sessionId: null, // pass a session ID to resume an existing flow
});

// NativeFlowState structure:
// - web mode (default): Full response with all features
// - web-minimal mode: Minimal response with layout, branding, and render hints excluded
//   The client SDK always requests `web` mode; `web-minimal` is only available through the Server SDK (BFF),
//   whose login endpoint (`handleLogin`) forwards an `?sdk=web-minimal` query parameter in embedded and native modes

// nativeFlowState.branding - branding information (logos, etc.) (`web` mode only)
// nativeFlowState.forms - array of form definitions with widgets
// nativeFlowState.layout - tree structure defining widget rendering order (`web` mode only)
// nativeFlowState.screen - current step identifier (e.g., 'identifier', 'password')
// nativeFlowState.finalizeUrl - set when authentication completes (the SDK has already finalized the session by then)

// Render the form based on nativeFlowState.screen, collect user input, then submit:
const nextNativeFlowState = await sdk.submitForm('identifier', {
	identifier: 'user@example.com',
});

if (nextNativeFlowState.finalizeUrl) {
	// submitForm() has already finalized the session at the IDP, exchanged the authorization code for tokens and stored them in the configured storage

	// Redirect to a protected page after successful authentication
	if (await sdk.isAuthenticated) {
		window.location.href = '/profile';
	}
} else {
	// Re-render for nextNativeFlowState.screen and repeat
}
```

#### Handle the callback

No separate callback page is needed for client-managed sessions. Once a response contains `finalizeUrl`, the SDK finalizes the session automatically - it exchanges the authorization code for tokens and stores the session (see the Login / Register example above).

With [server-managed sessions](#server-side-session-management) (`serverSessionUri` set), the SDK instead redirects the browser to your `redirectUri` with `?code=…`, so you need a callback page there that forwards the browser to your server's callback route (e.g. `/auth/callback`).

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing page to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login page**

Forward the parameters as query params to your login page:

```ts
// entry.ts
import { sdk } from './sdk';

const data = await sdk.entry();

// Redirect to login page with flow parameters
const params = new URLSearchParams({
	session_id: data.session_id,
	language: data.language,
});
window.location.href = `/login?${params}`;
```

Then on your login page, read the parameters and pass them to `startSession()`:

```ts
// login.ts
import { sdk } from './sdk';

// Read parameters from URL
const params = new URLSearchParams(window.location.search);
const state = await sdk.startSession({
	sessionId: params.get('session_id'),
	language: params.get('language'),
});

// Continue with the rendering loop (see minimal rendering example above)
```

**Option 2: Start session on the entry page**

Pass the parameters directly to `startSession()` on the same page:

```ts
// entry.ts
import { sdk } from './sdk';

const data = await sdk.entry();
const state = await sdk.startSession({
	sessionId: data.session_id,
	language: data.language,
});

// Continue with the rendering loop (see minimal rendering example above)
```

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```ts
// logout.ts
import { sdk } from './sdk';

await sdk.logout({
	postLogoutRedirectUri: window.location.origin,
});
```

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

With [server-managed sessions](#logging-out), `logout()` doesn't end the server session - send the browser to your server's logout route instead.

#### Native login controller

To build a native login integration for a framework that has no Strivacity package, use `createNativeLoginController`. It holds the state the framework packages expose through `useNativeLogin` (`loading`, `forms`, `messages` and `state`) and publishes every change as a new immutable snapshot. Bind the snapshots to your framework's reactivity, and call `start()` once when the login UI mounts.

```ts
import { createNativeLoginController } from '@strivacity/sdk-core/utils';
import { sdk } from './sdk';

// The SDK is passed as a getter: it is resolved on every use, so it may be created after the controller
const controller = createNativeLoginController(() => sdk, {
	onLogin: () => (window.location.href = '/profile'),
	onFallback: (error) => (window.location.href = error.url.toString()),
	onError: (error) => console.error(error),
});

const unsubscribe = controller.subscribe(({ loading, state, forms, messages }) => render({ loading, state, forms, messages }));

await controller.start(); // sdk.init() + startSession(options.params)

controller.setFormValue('identifier', 'identifier', 'user@example.com');
await controller.submitForm('identifier');
```

`setOptions(options)` replaces the callbacks, for example on every render. `triggerFallback()`, `triggerClose()` and `setMessage()` work the same way as in `useNativeLogin`.

#### Token management

Call these methods to manage the session and access token.

```ts
import { sdk } from './sdk';

// Refresh the access token using the refresh token
// (automatically waits for SDK initialization and session loading)
await sdk.refresh();

// Revoke all tokens at the authorization server and clear the local session
// (automatically waits for SDK initialization and session loading)
await sdk.revoke();

// Get the current access and refresh tokens (synchronous property - ensure SDK is initialized first)
await sdk.init();
const idToken = sdk.idTokenClaims // read-only property - returns the current ID token claims or null if not authenticated
const accessToken = sdk.accessToken; // read-only property - returns the current access token or null if not authenticated
const refreshToken = sdk.refreshToken; // read-only property - returns the current refresh token or null if not authenticated
```

---

### Server-side session management

Set `serverSessionUri` on the SDK options when using a backend-for-frontend ([BFF](../../README.md#bff)) architecture, to route login requests through your own server-side endpoint instead of the SDK's default IDP endpoint - useful when the request must be built/signed server-side. Setting it also switches the client SDK into server-managed session mode: tokens are never read from or written to client-side storage.

```ts
// sdk.ts
import { initFlow } from '@strivacity/sdk-core';

const sdk = initFlow({
	mode: 'redirect', // works the same way in popup, embedded, and native modes
	issuer: 'https://<YOUR_TENANT_DOMAIN>',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile', 'email'],
	serverSessionUri: '/api/auth/login', // Requests are routed through your server; tokens are NOT written to client storage
});

await sdk.login();
```

Sensitive OAuth2 parameters (`client_id`, `redirect_uri`, `scope`, ...) are never sent to `serverSessionUri` - your endpoint is responsible for adding those itself; only the non-sensitive extras (`prompt`, `display`, `acrValues`, `loginHint`, `uiLocales`, `audiences`, `resources`) are appended as query params.

In this mode, the SDK relies on your backend to:
- Build/sign the authorization request and proxy it to the IDP
- Store tokens in server-side storage (e.g., Redis, encrypted cookies)
- Complete the OAuth2 code exchange and redirect the browser back to your app

#### Logging out

`logout()` doesn't end a server-managed session: it clears the local client state and redirects to the IDP end-session endpoint only if the client session holds an ID token, but the server session is left in place. Send the browser to your server's logout route (`handleLogout`, such as `/api/auth/logout`) instead, which clears the server session and redirects to the IDP end-session endpoint (or straight to `returnTo` / `postLogoutRedirectUri` when the session holds no ID token):

```ts
// logout.ts
window.location.assign('/api/auth/logout?returnTo=/goodbye');
```

The logout route accepts an optional `returnTo` query param, and only a same-origin one. A missing, invalid, or cross-origin value falls back to the server's `postLogoutRedirectUri`. Whichever URL is used must also be registered as an allowed post-logout redirect URI in your Strivacity application client settings.

#### Refreshing the session

The browser never refreshes tokens in this mode - the refresh token stays on the server, and `autoRefresh` is ignored. Refresh the session on the server instead: during server rendering with the Server SDK's [`getSession(request)`](#server-session-helpers), or by sending the browser to your server's refresh route (`handleRefresh`, such as `/api/auth/refresh`), which rotates the session cookie and redirects back to a same-origin `returnTo`. On the Server SDK, `autoRefresh: false` turns off the refresh in `getSession` (and in the integrations built on it).

`refresh()` does the navigation for you: it sends the browser (as a full-page navigation, also in `popup` mode) to `${authUriPrefix}/refresh?returnTo=<url>`, where `returnTo` defaults to the current URL. `authUriPrefix` defaults to `/auth`, the Server SDK's own default, so set it on the client only when your server uses another prefix.

```ts
// sdk.ts
const sdk = initFlow({
	// ...
	serverSessionUri: '/api/auth/login',
	authUriPrefix: '/api/auth', // Where your server serves the auth routes: refresh() and the guards use `${authUriPrefix}/refresh`
});

// Navigates to /api/auth/refresh?returnTo=/profile, then the server redirects back to /profile
await sdk.refresh({ returnTo: '/profile' });
```

#### Accessing the session on the client-side

Tokens never reach the client SDK in this mode, so expose only what the UI needs - typically the decoded `claims`, not the raw tokens - through your own backend:

- **Server-rendered pages** - fetch the session once per request in your server-side loader/layout via the Server SDK's `getSession(request)` (it refreshes a near-expiry session first with `autoRefresh`, so call it where the response cookies can still be written), then pass the safe subset down to your client-rendered components. Framework-specific SDK wrappers already handle this for you internally.
- **Client-rendered pages** - same idea, but triggered from the client: expose a small endpoint (e.g. `/api/auth/session`) that calls `getSession(req)` server-side and returns the safe subset as JSON, then fetch it on the client and store it wherever your client-side session state lives.

```ts
// api/auth/session.ts (server route)
import { sdk } from './server';

export async function GET(req: Request) {
	const session = await sdk.getSession(req);
	return Response.json(session ? { claims: session.claims } : null);
}
```

```ts
// main.ts (client)
const response = await fetch('/api/auth/session', { credentials: 'include' });
const { claims } = (await response.json()) ?? {};

// Keep `claims` in your own client-side state (store, context, ...) and render from it
```

Note that the client SDK's `isAuthenticated` / `isAuthenticatedSync` only report `true` for a session that has an `access_token` and a future `expires_at`, so loading a claims-only object into the SDK won't mark the user as authenticated. If you want the client SDK state (`isAuthenticated`, `idTokenClaims`, events) to reflect the server session - as the [example apps](../../apps) do - return the full session from your endpoint and load it with `updateSession()`. This exposes the access token to the browser (it's still never written to client-side storage), so only do it when that trade-off is acceptable. Strip the refresh and ID tokens on the server with `toClientSession(session)` (from `@strivacity/sdk-core/utils`), which returns a copy without `refresh_token` and `id_token`:

```ts
// api/auth/session.ts (server route)
import { toClientSession } from '@strivacity/sdk-core/utils';
import { sdk } from './server';

export async function GET(req: Request) {
	return Response.json(toClientSession(await sdk.getSession(req)));
}
```

```ts
// main.ts (client)
import { sdk } from './client';

const response = await fetch('/api/auth/session', { credentials: 'include' });

const session = response.ok ? await response.json() : null; // endpoint returns `toClientSession(session)`, or null

if (session?.access_token) {
	await sdk.updateSession(session);
}
```

---

## Server SDK

This package provides a backend-for-frontend ([BFF](../../README.md#bff)) server implementation that handles OAuth2 state and PKCE management automatically. Use it when you need to route authentication traffic through your own server for request signing, custom headers, or additional validation.

<a id="server-usage"></a>
### Usage

Here's a minimal example of how to set up the server SDK with Express. The SDK handles all the OAuth2 flow and session management for you, so your routes can be very simple.

```ts
// server.ts
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { toWebRequest } from './utils';

// Initialize the server SDK
const sdk = createBaseServerSDK(

	// Server adapter
	{
		toRequest: (req) => toWebRequest(req), // converts framework-specific request to standard Web Request
		redirect: (url, status) => Response.redirect(url, status), // optional - (url, status, event?) => Response; override default redirect behavior
	},

	// Server configuration
	{
		mode: 'redirect', // authentication mode
		issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
		clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
		redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
		scopes: ['openid', 'profile', 'email'], // requested user permissions/data
		cookieSecret: process.env.COOKIE_SECRET, // http-only cookie encryption key (random 32+ characters); Required if using cookie storage (default)
	}
);
```

```ts
// routes.ts
import { sdk } from './server';
import { mount } from './utils';

/**
 * Starts the login flow and redirects to the IDP.
 * @modes all
 * @returns 302 redirect to IDP
 */
mount('get', '/api/auth/login', (req) => sdk.handleLogin(req));

/**
 * Starts the registration flow and redirects to the IDP.
 * @modes all
 * @returns 302 redirect to IDP
 */
mount('get', '/api/auth/register', (req) => sdk.handleRegister(req));

/**
 * Handles external flow entry (e.g., password reset link).
 * @modes embedded, native
 * @returns 302 redirect to `loginPageUri`
 */
mount('get', '/api/auth/entry', (req) => sdk.handleEntry(req));

/**
 * Completes authentication (handles the callback from the IDP).
 * @modes all
 * @returns 302 redirect or popup close script
 */
mount('get', '/api/auth/callback', (req) => sdk.handleCallback(req));

/**
 * Refreshes the access token.
 * @modes all
 * @returns 204 No Content or 302 redirect
 */
mount('get', '/api/auth/refresh', (req) => sdk.handleRefresh(req));

/**
 * Revokes tokens and clears the session.
 * @modes all
 * @returns 302 redirect to `postLogoutRedirectUri`
 */
mount('get', '/api/auth/revoke', (req) => sdk.handleRevoke(req));

/**
 * Ends the session and redirects to the IDP logout page.
 * Accepts an optional same-origin `?returnTo=` (falls back to `postLogoutRedirectUri`).
 * @modes all
 * @returns 302 redirect to IDP logout (or straight to `returnTo` when the session has no ID token)
 */
mount('get', '/api/auth/logout', (req) => sdk.handleLogout(req));

/**
 * Processes back-channel logout requests from the IDP.
 * @modes all
 * @returns 200 OK (400 invalid token, 501 storage without deleteByLogoutToken, 500 delete failed)
 */
mount('post', '/api/auth/backchannel-logout', (req) => sdk.handleBackChannelLogout(req));
```

```ts
// utils.ts
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Router } from 'express';
import { Readable } from 'stream';

const handlers = Router();

// Apply Web Response to Express response
export async function applyResponse(response: Response, res: ExpressResponse): Promise<void> {
	res.status(response.status);

	for (const [key, value] of response.headers.entries()) {
		if (key.toLowerCase() === 'set-cookie') {
			continue;
		}

		res.setHeader(key, value);
	}

	const setCookies = response.headers.getSetCookie();

	if (setCookies.length) {
		res.setHeader('set-cookie', setCookies);
	}

	if (!response.body) {
		res.end();
		return;
	}

	await new Promise<void>((resolve, reject) => {
		Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
			.pipe(res)
			.on('finish', resolve)
			.on('error', reject);
	});
}

// Mount a handler for a specific HTTP method and path
export function mount(method: 'get' | 'post', path: string, handler: (req: ExpressRequest) => Promise<Response>): void {
	handlers[method](path, async (req, res, next) => {
		try {
			await applyResponse(await handler(req), res);
		} catch (error) {
			next(error);
		}
	});
}

// Convert Express request to Web Request
export function toWebRequest(req: ExpressRequest): Request {
	const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
	const headers = new Headers();

	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		for (const v of Array.isArray(value) ? value : [value]) {
			headers.append(key, v);
		}
	}

	const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

	return new Request(url, {
		method: req.method,
		headers,
		...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
	} as RequestInit);
}
```

For complete utility implementations, see the [backend example app](../../apps/backend) in this repository.

<a id="server-storages"></a>

By default, the server SDK stores:
- **Tokens** (access_token, refresh_token, id_token): encrypted in http-only cookies
- **Login state**: global in-memory Map

#### Built-in session storages

- **`createEncryptedCookieStorage(secret, adapter, options?)`** - default storage that keeps the session encrypted in an http-only cookie.
- **`createSessionIdCookieStorage(adapter, storage, options?)`** - puts only a small, random session-id cookie on the client and keeps the actual session payload in the `storage` you provide. It supports back-channel logout when `storage` implements `deleteByLogoutToken`.

```ts
// server.ts
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { createSessionIdCookieStorage, createServerMemoryStorage } from '@strivacity/sdk-core/storages';
import { toWebRequest } from './utils';

const adapter = { toRequest: (req) => toWebRequest(req) };

const sdk = createBaseServerSDK(adapter, {
	storage: createSessionIdCookieStorage(
		adapter,
		createServerMemoryStorage(),
		{
			// maxAge: 30 * 24 * 60 * 60 // Without maxAge this is a browser-session cookie that gets cleared when the browser closes
		},
	),
});
```

#### Custom storage

You can customize storage by providing `storage` and `stateStorage` options.
For example you can use [unstorage](https://npmjs.com/package/unstorage) which provides a unified async key-value API with dozens of built-in drivers (Redis, Cloudflare KV, filesystem, memory, and more).

The `get` / `set` / `delete` methods of a `ServerStorage` receive the incoming request event as their last argument, while the SDK always calls it with the same key (`storageKey`). A storage that ignores the event would therefore share a single session across all users - key the data per browser session instead. The easiest way is to wrap your key-value store with `createSessionIdCookieStorage`, which puts a random session id in a cookie and calls your store with that id as the key:

```ts
// storage.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import type { ServerStorage, SDKStorage } from '@strivacity/sdk-core/types';

const unstorageInstance = createStorage({
	driver: redisDriver({ url: process.env.REDIS_URL }),
});

// Session payload store - `key` is the per-browser session id provided by `createSessionIdCookieStorage`
// (raw get/set keep the serialized session string as-is)
export const sessionStore: ServerStorage = {
	async get(key) {
		return unstorageInstance.getItemRaw<string>(`session:${key}`);
	},
	async set(key, value) {
		await unstorageInstance.setItemRaw(`session:${key}`, value);
	},
	async delete(key) {
		await unstorageInstance.removeItem(`session:${key}`);
	},
	// Required for OIDC back-channel logout support.
	// Scans all stored sessions and removes those whose ID token claims match the logout token's sid or sub claim.
	async deleteByLogoutToken(logoutToken) {
		const keys = await unstorageInstance.getKeys('session');
		await Promise.all(
			keys.map(async (key) => {
				const raw = await unstorageInstance.getItemRaw<string>(key);
				if (!raw) return;
				const session = JSON.parse(raw);
				if (
					(logoutToken.sid && session.claims?.sid === logoutToken.sid) ||
					(logoutToken.sub && session.claims?.sub === logoutToken.sub)
				) {
					await unstorageInstance.removeItem(key);
				}
			}),
		);
	},
};

// Custom state storage for OAuth2 state parameter
export const stateStorage: SDKStorage = {
	async get(key) {
		return unstorageInstance.getItem<string>(key);
	},
	async set(key, value) {
		await unstorageInstance.setItem(key, value);
	},
	async delete(key) {
		await unstorageInstance.removeItem(key);
	},
};
```

```ts
// server.ts
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { createSessionIdCookieStorage } from '@strivacity/sdk-core/storages';
import { toWebRequest } from './utils';
import { sessionStore, stateStorage } from './storage';

const adapter = { toRequest: (req) => toWebRequest(req) };

const sdk = createBaseServerSDK(adapter, {
	// other configuration options
	storage: createSessionIdCookieStorage(adapter, sessionStore), // Custom Redis-backed session storage, keyed by a session-id cookie
	stateStorage: stateStorage, // Custom Redis-backed state storage
});
```

<a id="server-session-helpers"></a>
### Session helpers

Besides the route handlers, the Server SDK exposes the session directly, for your own routes, loaders and middleware. Each method takes the framework-native request event:

| Method                           | Description                                                                                                                                                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getSession(event)`              | Returns the session, or `null`. With `autoRefresh` (the default) it refreshes the session first when the access token is expired or within `refreshSkew` of expiry and a refresh token exists, like the client SDK. Refreshes at most once per request event - concurrent and later calls with the same event share the result. A failed refresh resolves to `null`. With `autoRefresh: false` - the option, or `getSession(event, { autoRefresh: false })` for one call - it returns the stored session |
| `updateSession(session, event)`  | Stores a session                                                                                                                                                                                                                                                                                    |
| `refreshSession(event)`          | Refreshes the session with its refresh token (throws on failure and clears the session)                                                                                                                                                                                                                                    |
| `revokeSession(event)`           | Revokes the refresh token (or the access token when there is none) and clears the session                                                                                                                                                                                                                                                           |

`getSession` queues the rotated session cookie on the event instead of writing it to a response, so write the queued cookies to the response yourself with `flushSetCookies(event, response)` (from `@strivacity/sdk-core/utils`). The framework SDKs do this for you in their middleware and SSR integrations.

```ts
// api/me.ts (server route)
import { flushSetCookies } from '@strivacity/sdk-core/utils';
import { sdk } from './server';

export async function GET(req: Request) {
	const session = await sdk.getSession(req);
	return flushSetCookies(req, Response.json(session ? { claims: session.claims } : null, { status: session ? 200 : 401 }));
}
```

<a id="server-backchannel-logout"></a>
### Back-channel logout

OIDC back-channel logout lets the authorization server terminate sessions server-to-server, without involving the browser. When the IDP sends a logout event (e.g. an admin terminates a session, or the user logs out from a different device), it POSTs a signed `logout_token` JWT to the `/api/auth/backchannel-logout` route you mounted earlier, which the SDK routes to `sdk.handleBackChannelLogout(req)`.

The handler verifies the token's signature against the IDP's JWKS, validates the `iss`, `aud`, `iat` (freshness), and `jti` (replay protection) claims, requires the `http://schemas.openid.net/event/backchannel-logout` event and a `sid` or `sub` claim, then calls `storage.deleteByLogoutToken({ sid?, sub? })` to remove the matching session(s). It responds `200` on success, `400` for an invalid or malformed `logout_token`, `501` if the configured storage doesn't implement `deleteByLogoutToken`, and `500` if deleting the session fails.

> **The default encrypted-cookie storage does not support back-channel logout** because each cookie is bound to a single browser session - there is no server-side index to look up by `sid` or `sub`. To support back-channel logout, use [`createSessionIdCookieStorage`](#server-storages) with a `storage`, or a fully custom server storage as shown in the [Custom storage](#server-storages) example above.

Configure the **Back-channel logout URI** in your Strivacity application settings to:

```
https://your-app.example.com/api/auth/backchannel-logout
```

<a id="server-client-authentication"></a>
### Client authentication

By default the Server SDK is a public client: the token and revocation requests (code exchange, refresh, revoke) identify the application with `client_id` only, and PKCE protects the authorization code. Set `clientSecret` to authenticate as a confidential client.

```ts
const sdk = createServerSDK({
	// ...
	clientSecret: process.env.CLIENT_SECRET,
	tokenEndpointAuthMethod: 'client_secret_basic', // default with clientSecret; or 'client_secret_post'
});
```

| `tokenEndpointAuthMethod` | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `client_secret_basic`     | Confidential client, secret sent with HTTP Basic authentication |
| `client_secret_post`      | Confidential client, secret sent in the request body            |
| `none`                    | Public client, no secret                                        |

- Select the same method for the application in the Strivacity Admin Console. PKCE is used with every method.
- The secret is server-only: the client SDK throws a `ConfigurationError` when it receives `clientSecret`. Keep it out of options objects that are shared with the browser, and out of environment variables that your bundler exposes to client code.
- A missing secret for `client_secret_basic` / `client_secret_post`, or a secret with `none`, throws a `ConfigurationError` when the SDK is created. A rejected secret surfaces as an `OidcError` with `invalid_client`.

<a id="server-configuration-options"></a>
### Configuration Options

The server SDK accepts the same configuration as the client SDK, plus server-specific options:

```ts
{
	mode: 'redirect' | 'popup' | 'embedded' | 'native',
	issuer: string,
	clientId: string,
	redirectUri: string,
	scopes: string[],
	storage: ServerStorage, // Custom session storage
	stateStorage: SDKStorage, // Custom OAuth2 state storage
	serverSessionUri: string, // Optional - defaults to `${authUriPrefix}/login`
	// ... other client SDK options

	// server-specific options
	cookieSecret: '<your-encryption-key>', // encrypts http-only cookies
	clientSecret: process.env.CLIENT_SECRET, // Optional - confidential client secret, see Client authentication
	tokenEndpointAuthMethod: 'client_secret_basic', // 'client_secret_basic' | 'client_secret_post' | 'none' (default: 'client_secret_basic' with clientSecret, otherwise 'none')
	authUriPrefix: '/auth', // Prefix for auth routes (default: '/auth')
	loginPageUri: '/login', // App's login page; the entry route (`handleEntry`) redirects there with `session_id`, `short_app_id` and `language` (default: '/login')
	cookieMaxAge: 2592000, // Max age for session cookies in seconds (default: 30 days)
	postLoginRedirectUri: '/profile', // Redirect after login when no `?returnTo=` is given (default: origin of `redirectUri`)
	postLogoutRedirectUri: '/', // Redirect after logout (default: origin of `redirectUri`)
}
```

---

## Shared features

These features are available in both client and server SDK implementations.

### Storages

The SDK provides several built-in storage drivers to help you persist session state and tokens. Choose the driver that fits your environment, target lifetime, and runtime constraints (Client vs. Server).

| Storage | Export | Persists Across | Environment | Default |
| :--- | :--- | :--- | :--- | :--- |
| **`localStorage`** | `createLocalStorage()` | Browser restarts | Client-side only | `storage` (client) |
| **`sessionStorage`** | `createSessionStorage()` | Tab lifetime | Client-side only | `stateStorage` (client) |
| **`IndexedDB`** | `createIndexedDBStorage()` | Browser restarts (larger quota) | Client-side only | - |
| **`Cache API`** | `createCacheAPIStorage()` | Browser restarts (works in Service Workers too) | Client-side only | - |
| **`Memory`** | `createMemoryStorage()` | Page / Process lifetime | Client-side & Server-side | - |
| **`Worker`** | `createWorkerStorage(worker)` | Depends on the backing storage inside the Worker | Client-side & Server-side | - |
| **`globalStorage`** | `createServerStateStorage()` | Process/Server runtime lifetime | Server-side only | `stateStorage` (server) |
| **`cookieStorage`** | `createEncryptedCookieStorage()` | Cookie expiration / Browser restarts | Server-side only | `storage` (server) |
| **`sessionIdStorage`** | `createSessionIdCookieStorage()` | Session cookie / Browser restarts | Server-side only | `storage` (server) |

#### Session Storages

Tokens and session data can be configured depending on your security and persistence needs. Swap out the default by passing any of the built-in factory functions - or any custom implementation of `SDKStorage` (`get`, `set`, `delete`) - as the `storage` option in `initFlow` (client) or when creating the server SDK.

#### State storages

The SDK stores login state parameters separately from session tokens. Override `stateStorage` independently from `storage`:

```ts
import { initFlow } from '@strivacity/sdk-core';
import { createLocalStorage, createSessionStorage } from '@strivacity/sdk-core/storages';

const sdk = initFlow({
	mode: 'redirect',
	issuer: 'https://<YOUR_TENANT_DOMAIN>',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile', 'email'],
	storage: createLocalStorage(), // session tokens in localStorage
	stateStorage: createSessionStorage(), // OAuth2 state in sessionStorage (cleared when tab closes)
});
```

**Why separate state storage?**

Login state parameters are temporary - they are only needed between starting the flow and completing the callback. Using `sessionStorage` (client-side) or `globalStorage` (server-side) for state improves security by ensuring these transient values do not persist across browser sessions, while tokens can safely remain in `localStorage` for persistent authentication.

Any storage implementing `SDKStorage` can be used for state storage.

#### Advanced Storage Configurations

Beyond standard drivers, the SDK supports isolated runtime environments and custom storage contracts.

##### Session-id Cookie Storage

Server-side only. `createSessionIdCookieStorage(adapter, storage, options?)` puts only a small, random session-id cookie on the client and delegates the actual session payload to the `storage` you provide - keeping large sessions out of cookies entirely, and enabling [back-channel logout](#server-backchannel-logout) as long as `storage` implements `deleteByLogoutToken`:

```ts
// server.ts
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { createSessionIdCookieStorage, createServerMemoryStorage } from '@strivacity/sdk-core/storages';
import { toWebRequest } from './utils';

const adapter = { toRequest: (req) => toWebRequest(req) };

const sdk = createBaseServerSDK(adapter, {
	// ...
	storage: createSessionIdCookieStorage(adapter, createServerMemoryStorage()),
});
```

> See [Built-in session storages](#server-storages) for more details, including using an external store (e.g. Redis) instead of `createServerMemoryStorage()`.

##### Worker Storage

For enhanced security isolation, you can offload all storage operations to a Web Worker via `postMessage`, so the persisted session lives in the worker's storage (e.g. IndexedDB) instead of `localStorage`. Note that the SDK still keeps the active session in main-thread memory while the page is running. Simply instantiate the Worker and bridge it using `handleWorkerStorageRequests(storage)` inside the worker context:

```ts
// storage.worker.ts
import { handleWorkerStorageRequests, createIndexedDBStorage } from '@strivacity/sdk-core/storages';

handleWorkerStorageRequests(createIndexedDBStorage());
```

```ts
// sdk.ts
import { initFlow } from '@strivacity/sdk-core';
import { createWorkerStorage } from '@strivacity/sdk-core/storages';

const worker = new Worker(new URL('./storage.worker.ts', import.meta.url), { type: 'module' });

const sdk = initFlow({
	// ...
	storage: createWorkerStorage(worker),
});
```

---

### Session state

All flow instances expose the same set of getters:

```ts
// Async - waits for init, optionally auto-refreshes an expired token (never when serverSessionUri is set)
const isAuthenticated: boolean = await sdk.isAuthenticated;

// Sync - true only if a non-expired session is already in memory
const isAuthenticated: boolean = sdk.isAuthenticatedSync;

// Token values (available synchronously after init)
const accessToken: string | null = sdk.accessToken;
const refreshToken: string | null = sdk.refreshToken;
const idTokenClaims: IdTokenClaims | null = sdk.idTokenClaims;

// Token expiration info (available synchronously after init)
const expired: boolean = sdk.accessTokenExpired;
const expiresAt: number | null = sdk.accessTokenExpirationDate; // Unix seconds

// Session metadata (available in embedded and native modes)
const sessionId: string | null = sdk.sessionId; // current session identifier
const shortAppId: string | null = sdk.shortAppId; // short application identifier
const language: string = sdk.language; // current UI language code

// Verify authentication status (auto-refreshes an expired token if a refresh token is available, unless serverSessionUri is set)
const ok: boolean = await sdk.checkAuthentication();
// Verify authentication status without attempting a refresh
const ok: boolean = await sdk.checkAuthentication({ autoRefresh: false });
```

Tabs that share the session storage (`localStorage`, IndexedDB, ...) never refresh at the same time: `refresh()` (also the automatic one) runs under a [Web Lock](https://developer.mozilla.org/docs/Web/API/Web_Locks_API) per client and storage key. A tab that waited for the lock first re-reads the storage and uses the session another tab has just refreshed, instead of sending the old refresh token again, which would fail with refresh token rotation and clear the session. Without the Web Locks API, refresh runs directly.

---

### SDK events

Subscribe to authentication lifecycle events via `subscribeToEvent` (one specific event) or `subscribeToAllEvents` (all events). Both return a `{ dispose() }` handle - call `dispose()` to unsubscribe.

| Event                | Payload                                 | When it fires                                                             |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `init`               | -                                       | SDK has finished initializing                                             |
| `sessionLoaded`      | `{ idToken, accessToken, refreshToken, claims }` | An existing session was read from storage on startup                      |
| `sessionUpdated`     | `{ idToken, accessToken, refreshToken, claims }` | The session was updated (e.g., after a token refresh)                     |
| `sessionCleared`     | -                                       | The session was cleared (e.g., after logout or token revocation)          |
| `loginInitiated`     | -                                       | A login or registration redirect / popup has started                      |
| `flowInitiated`      | -                                       | A native or embedded flow has started                                     |
| `loggedIn`           | `{ idToken, accessToken, refreshToken, claims }` | Tokens were received and stored after a successful login                  |
| `logoutInitiated`    | `{ idToken, claims }`                   | Logout was initiated, before the redirect to the IDP end-session endpoint |
| `tokenRefreshed`     | `{ idToken, accessToken, refreshToken, claims }` | Access token was silently refreshed                                       |
| `tokenRefreshFailed` | `{ refreshToken }`                      | A token refresh attempt failed (refresh token may be expired)             |
| `accessTokenExpired` | `{ accessToken, refreshToken }`         | The stored access token has passed its expiration time                    |
| `tokenRevoked`       | `{ token, tokenTypeHint }`              | A token was successfully revoked at the authorization server              |
| `tokenRevokeFailed`  | `{ token, tokenTypeHint }`              | A token revocation attempt failed                                         |

```ts
const sub = sdk.subscribeToEvent('tokenRefreshed', ({ accessToken }) => {
	console.log('Token refreshed:', accessToken);
});

// Unsubscribe
sub.dispose();

// Subscribe to all events with a single callback
const sub = sdk.subscribeToAllEvents((...args) => {
	console.log('SDK event:', args);
});

sub.dispose();
```

---

### Logging

#### Built-in logger

Call `createDefaultLogging()` to get a console logger with per-request correlation ID support:

```ts
import { initFlow } from '@strivacity/sdk-core';
import { createDefaultLogging } from '@strivacity/sdk-core/utils';

const sdk = initFlow({
	// ...
	logging: createDefaultLogging(),
});
```

#### Custom logger

Use a custom logger when you need to integrate SDK logs with your application's logging infrastructure (e.g., Sentry, Datadog, Winston) or when you want to filter, format, or route logs differently than the console.

Create a factory function that returns an object implementing the `SDKLogging` interface:

```ts
import type { SDKLogging } from '@strivacity/sdk-core/types';

export function createMyLogger(): SDKLogging {
	const logger: SDKLogging = {
		/** Set by the SDK per request; use to correlate related log lines */
		xEventId: undefined,

		debug(message: string): void {
			const msg = logger.xEventId ? `[${logger.xEventId}] ${message}` : message;
			console.debug(msg);
		},

		info(message: string): void {
			const msg = logger.xEventId ? `[${logger.xEventId}] ${message}` : message;
			console.info(msg);
		},

		warn(message: string): void {
			const msg = logger.xEventId ? `[${logger.xEventId}] ${message}` : message;
			console.warn(msg);
		},

		error(message: string, error?: unknown): void {
			const msg = logger.xEventId ? `[${logger.xEventId}] ${message}` : message;
			console.error(msg, error);
		},
	};

	return logger;
}

const sdk = initFlow({
	// ...
	logging: createMyLogger(),
});
```

---

### HTTP client

The SDK uses `fetch` for all requests. Replace it by implementing the `SDKHttpClient` interface and passing an instance via `httpClient` (`request` and `sendTokenRequest` are both required, so it's easiest to wrap the built-in `createHttpClient()` and override just what you need). Useful for attaching custom headers to every request, routing traffic through a proxy, or using a platform-specific transport (e.g. Capacitor's `CapacitorHttp`).

```ts
import type { SDKHttpClient, HttpClientResponse } from '@strivacity/sdk-core/types';
import { initFlow } from '@strivacity/sdk-core';
import { createHttpClient } from '@strivacity/sdk-core/utils';

function createCustomHttpClient(): SDKHttpClient {
	const base = createHttpClient();

	return {
		...base,
		async request<T>(url: string | URL, options?: RequestInit): Promise<HttpClientResponse<T>> {
			return base.request<T>(url, {
				...options,
				headers: {
					'x-sty-app-id': 'my-app',
					...(options?.headers as Record<string, string>),
				},
			});
		},
	};
}

const sdk = initFlow({
	// ...
	httpClient: createCustomHttpClient(),
});
```

> **CORS note:** custom request headers must be explicitly listed in the Strivacity cluster's `Access-Control-Allow-Headers` configuration - otherwise the browser blocks the preflight `OPTIONS` request.

---

## Advanced

Advanced SDK customization patterns for specialized use cases.

### Custom flow

For cases where none of the built-in modes fit-for example, when all authentication traffic must go through your own backend server in a specific way - you can build a completely custom flow on top of `createBaseFlow`.

`createBaseFlow` is the base factory function used by all built-in flows. It gives you the full shared method set (`init`, `checkAuthentication`, `refresh`, `revoke`, `logout`, `handleCallback`, `getSession`, `updateSession`, `cleanupSession`, `subscribeToEvent`, `subscribeToAllEvents`, `tokenExchange`) and lets you add your own login logic on top.

Wire it up through `initFlow` by passing your factory function as the `factory` option - when present, `initFlow` calls it with the raw options you passed to `initFlow` (defaults not applied - call `getSDKOptions()` yourself, as below) instead of dispatching to the built-in `redirect`/`popup`/`embedded`/`native` flows.

```ts
import type { SDKInitConfig, SDKOptions } from '@strivacity/sdk-core/types';
import { getDefaultFlowState, getSDKOptions } from '@strivacity/sdk-core/utils';
import { createBaseFlow } from '@strivacity/sdk-core/flows/base';

export type CustomFlow = {
	init: ReturnType<typeof createBaseFlow>['init'];
	login: (params?: Record<string, unknown>) => Promise<void>;
	refresh: () => Promise<void>;
	revoke: () => Promise<void>;
	logout: () => Promise<void>;
	// Add your own methods here
};

export function createCustomFlow(initConfig: SDKInitConfig): CustomFlow {
	const state = getDefaultFlowState();
	const options = getSDKOptions<SDKOptions>(initConfig);
	const base = createBaseFlow(state, options);

	async function login(params: Record<string, unknown> = {}): Promise<void> {
		await base.init();

		const response = await fetch('/api/auth/login', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			throw new Error('Login not started');
		}
	}

	async function refresh(): Promise<void> {
		const response = await fetch('/api/auth/refresh', {
			method: 'POST',
			credentials: 'include',
		});

		if (!response.ok) {
			const failedRefreshToken = state.session?.refresh_token;
			await base.cleanupSession();
			base.dispatchEvent('tokenRefreshFailed', [{ refreshToken: failedRefreshToken }]);
			return;
		}

		const session = await response.json();
		await base.updateSession(session);
		base.dispatchEvent('tokenRefreshed', [{ accessToken: session.access_token, claims: session.claims }]);
	}

	async function revoke(): Promise<void> {
		const response = await fetch('/api/auth/revoke', {
			method: 'POST',
			credentials: 'include',
		});

		const token = state.session?.refresh_token ?? state.session?.access_token;

		if (!response.ok) {
			await base.cleanupSession();
			base.dispatchEvent('tokenRevokeFailed', [{ token }]);
			return;
		}

		await base.cleanupSession();
		base.dispatchEvent('tokenRevoked', [{ token }]);
	}

	async function logout(): Promise<void> {
		await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
		await base.cleanupSession();
	}

	return {
		init: base.init,
		login,
		refresh,
		revoke,
		logout,
		// Add your own methods here
	};
}
```

#### Usage:

You can call the factory directly:

```ts
import { createCustomFlow } from './custom-flow';

const sdk = createCustomFlow({
	mode: 'native',
	issuer: 'https://<YOUR_TENANT_DOMAIN>',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile'],
});

await sdk.login();
```

Or wire it through `initFlow` via the `factory` option:

```ts
import { initFlow } from '@strivacity/sdk-core';
import { createCustomFlow, type CustomFlow } from './custom-flow';

const sdk = initFlow<CustomFlow>({
	mode: 'native',
	issuer: 'https://<YOUR_TENANT_DOMAIN>',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile'],
	factory: createCustomFlow,
});

await sdk.login();
```

---

### Error handling

The SDK exports specialized error classes to help you handle different failure scenarios. All SDK errors extend the base `Error` class and include additional context.

#### Unsupported flow error

`initFlow()` throws `UnsupportedFlowError` when `mode` is missing or isn't one of `'redirect' | 'popup' | 'embedded' | 'native'`. TypeScript consumers get this caught at compile time, but it can still happen at runtime for plain JS consumers or when `mode` comes from an untyped source (e.g. an environment variable or CMS config):

```ts
import { initFlow } from '@strivacity/sdk-core';
import { UnsupportedFlowError } from '@strivacity/sdk-core/utils';

try {
	const sdk = initFlow({
		mode: mode as never, // e.g. loaded from an environment variable - could be an invalid value
		issuer: 'https://<YOUR_TENANT_DOMAIN>',
		clientId: 'YOUR_CLIENT_ID',
		redirectUri: 'https://your-app.example.com/callback',
	});
} catch (error) {
	if (error instanceof UnsupportedFlowError) {
		console.error(`Invalid mode: "${mode}". Must be one of: redirect, popup, embedded, native`);
	}
}
```

#### User interaction errors

These errors occur when the user cancels or blocks the authentication flow:

```ts
import { PopupBlockedError, PopupClosedError } from '@strivacity/sdk-core/utils';

try {
	await sdk.login();
} catch (error) {
	if (error instanceof PopupBlockedError) {
		// Browser blocked the popup - show instructions to allow popups
		console.error('Please allow popups for this site');
	} else if (error instanceof PopupClosedError) {
		// User closed the popup before completing login
		console.error('Login cancelled by user');
	}
}
```

#### SDK state errors

The SDK may throw `SessionExpiredError` when attempting operations with an expired session:

```ts
import { SessionExpiredError } from '@strivacity/sdk-core/utils';

// Example: Session expired during a native flow
try {
	const state = await sdk.startSession();
	// ... user fills in the form ...
	const nextState = await sdk.submitForm(state.screen, formData);
} catch (error) {
	if (error instanceof SessionExpiredError) {
		// Session expired during the flow - try to reload the page
	}
}
```

#### Network and server errors

These errors have a `recoverable` flag indicating whether retrying might succeed:

```ts
import { NetworkError, ServerError, OidcError, ProtocolError } from '@strivacity/sdk-core/utils';

try {
	await sdk.login();
} catch (error) {
	if (error instanceof NetworkError) {
		// Network request failed (offline, timeout, etc.)
		// error.recoverable === true - retry might work
		console.error('Network error - retrying...', error.message);
	} else if (error instanceof ServerError) {
		// Server returned a 5xx or 429 error, or the discovery document / JWKS request returned a non-OK response
		// error.recoverable === true - temporary server issue
		// error.status contains HTTP status code
		console.error(`Server error ${error.status}:`, error.message);
	} else if (error instanceof OidcError) {
		// OIDC protocol error from authorization server
		// error.recoverable === false - don't retry
		// error.error contains OIDC error code
		// error.errorDescription contains human-readable description
		console.error(`OIDC error ${error.error}:`, error.errorDescription);
	} else if (error instanceof ProtocolError) {
		// Protocol violation or invalid response
		// error.recoverable === false
		console.error('Protocol error:', error.message);
	}
}
```

#### Error categories

All network/server errors include a `category` property for easier error handling:

```ts
try {
	await sdk.refresh();
} catch (error) {
	if (error.category === 'Network') {
		// Retry with exponential backoff
	} else if (error.category === 'Server') {
		// Show maintenance message
	} else if (error.category === 'Oidc') {
		// Invalid configuration or expired session
	} else if (error.category === 'Protocol') {
		// Invalid response from server
	}
}
```

**Error categories:**
- `Network` - Network connectivity issues (recoverable)
- `Server` - Server errors: 5xx and 429 responses, and any non-OK discovery document / JWKS response (recoverable)
- `Oidc` - OIDC protocol errors from authorization server (not recoverable)
- `Protocol` - Protocol violations or invalid responses (not recoverable)
- `InvalidRequest` - Invalid SDK configuration, thrown as `ConfigurationError` (not recoverable)
- `Internal` - Unexpected internal SDK errors (not recoverable)

---

### Utility functions

The SDK exports several utility functions for advanced use cases. These are primarily used internally but can be useful for custom integrations.

#### Base64URL encoding

Base64URL is a URL-safe variant of Base64 encoding used in OIDC and JWT:

```ts
import { encodeBase64URL, decodeBase64URL } from '@strivacity/sdk-core/utils';

// Encode ArrayBuffer to Base64URL string
const buffer = new TextEncoder().encode('Hello, World!');
const encoded = encodeBase64URL(buffer.buffer);
console.log(encoded); // 'SGVsbG8sIFdvcmxkIQ'

// Decode Base64URL string to ArrayBuffer
const decoded = decodeBase64URL(encoded);
const text = new TextDecoder().decode(decoded);
console.log(text); // 'Hello, World!'
```

#### String encryption/decryption

AES-GCM encryption with HKDF key derivation for encrypting sensitive data:

```ts
import { encryptString, decryptString } from '@strivacity/sdk-core/utils';

const secret = 'your-encryption-secret';
const context = 'user-session'; // binds key to specific purpose

// Encrypt a string
const plaintext = 'sensitive data';
const encrypted = await encryptString(plaintext, secret, context);
console.log(encrypted); // Base64URL-encoded: salt(16) + iv(12) + ciphertext

// Decrypt a string
const decrypted = await decryptString(encrypted, secret, context);
console.log(decrypted); // 'sensitive data' or null if decryption fails
```

The encryption format is: `Base64URL(salt || iv || ciphertext)` where:
- `salt` (16 bytes) - random salt for HKDF key derivation
- `iv` (12 bytes) - random initialization vector for AES-GCM
- `ciphertext` - encrypted data

> **Note:** This is the same encryption used internally by the Server SDK for http-only cookies.

#### JWT decoding

Decode JWT tokens without verification (useful for debugging or extracting claims):

```ts
import { decodeJwt } from '@strivacity/sdk-core/utils';

const idToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
const claims = decodeJwt<{ sub: string; email: string }>(idToken);

console.log(claims.sub); // user ID
console.log(claims.email); // user email
```

> **Warning:** `decodeJwt` does NOT verify the signature. Use it only for debugging or when the token has already been verified by the SDK.

#### JWT verification

Verify and decode JWT tokens using RS256 signature verification with JWKS:

```ts
import type { SDKOptions } from '@strivacity/sdk-core/types';
import { verifyJwt } from '@strivacity/sdk-core/utils';

// Verify an access token or ID token from an external source
const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
const jwksUri = 'https://<YOUR_TENANT_DOMAIN>/.well-known/jwks.json';

// You need SDK options for HTTP client and caching
const options: SDKOptions = {
	mode: 'redirect',
	issuer: 'https://<YOUR_TENANT_DOMAIN>',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile', 'email'],
};

try {
	const claims = await verifyJwt<{ sub: string; email: string }>({
		token,
		jwksUri,
		options,
	});

	console.log('Token verified successfully');
	console.log(claims.sub); // user ID
	console.log(claims.email); // user email
} catch (error) {
	console.error('Token verification failed:', error.message);
	// Throws ProtocolError if signature is invalid or token is malformed
}
```

**When to use `verifyJwt`:**
- Verifying tokens received from external sources (e.g., webhooks, API callbacks)
- Server-side token verification when building custom server flows

> **Note:** The SDK automatically verifies ID tokens during login and refresh flows. The ID token's `exp` claim is checked with a 60-second clock-skew tolerance, so a device clock that runs slightly fast doesn't reject a freshly issued token with `ProtocolError('Token has expired')`. You only need `verifyJwt` when handling tokens from external sources.

#### PKCE code verifier generation

Generate a cryptographically secure PKCE code verifier:

```ts
import { generateCodeVerifier, generateRandomHex } from '@strivacity/sdk-core/utils';

// Generate PKCE code verifier (43-128 characters, base64url-encoded)
const codeVerifier = generateCodeVerifier();
console.log(codeVerifier); // e.g., 'a3K8Bx...' (128 chars)

// Generate random hex string (useful for state parameters)
const state = generateRandomHex(16); // 16 bytes = 32 hex chars
console.log(state); // e.g., '5f3a8b2c4d1e9f7a6b8c3d2e1f4a5b6c'
```

#### Script injection

Dynamically load external scripts (used internally for loading web components):

```ts
import { injectScript } from '@strivacity/sdk-core/utils';

// Inject a script tag with the given ID and source URL
injectScript('my-script', 'https://example.com/script.js');

// If a script with the same ID already exists, it won't be injected again
```

---

## Configuration reference

| Option                   | Type                                                 | Required | Default           | Description                                                                                                                                                |
| ------------------------ | ---------------------------------------------------- | -------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                   | `'redirect' \| 'popup' \| 'embedded' \| 'native'`    | Yes      | -                 | Authentication flow mode                                                                                                                                   |
| `issuer`                 | `string`                                             | Yes      | -                 | OIDC issuer URL of your Strivacity tenant                                                                                                                  |
| `clientId`               | `string`                                             | Yes      | -                 | OAuth2 public client ID                                                                                                                                    |
| `redirectUri`            | `string`                                             | Yes      | -                 | OAuth2 redirect URI (must match your application configuration)                                                                                            |
| `scopes`                 | `string[]`                                           | No       | `['openid']`      | Requested OIDC scopes                                                                                                                                      |
| `responseType`           | `'code'`                                             | No       | `'code'`          | OAuth2 response type                                                                                                                                       |
| `responseMode`           | `'query' \| 'fragment'`                              | No       | `'query'`         | OAuth2 response mode                                                                                                                                       |
| `storage`                | `SDKStorage`                                         | No       | `localStorage`    | [Session storage](#storages)                                                                                                                       |
| `stateStorage`           | `SDKStorage`                                         | No       | `createSessionStorage()` | OAuth2 PKCE / state storage                                                                                                                         |
| `storageKey`       | `string`                                             | No       | `'sty.session'`   | Key under which the session is stored in the storage                                                                                                       |
| `autoRefresh`            | `boolean`                                            | No       | `true`            | Refreshes an expired (or about-to-expire, see `refreshSkew`) access token when authentication is checked (`isAuthenticated`, `checkAuthentication()`, route guards). There is no background timer. Set to `false` to manage refresh manually. Ignored in the browser with `serverSessionUri` - the server refreshes the session instead. On the Server SDK, `false` turns off the refresh in `getSession`. Browser tabs that share the session storage refresh, revoke and log out one at a time (Web Locks API) |
| `refreshSkew`            | `number`                                             | No       | `60`              | Number of seconds before the access token's actual expiration that it is treated as expired, so it gets refreshed early (capped at half of the token lifetime, so short-lived tokens are not refreshed on every check) |
| `clockSkew`              | `number`                                             | No       | `60`              | Number of seconds of clock difference tolerated between the device and the authorization server when validating the ID token's expiration                |
| `lazyLoad`               | `boolean`                                            | No       | `false`           | When `true`, skips the automatic `init()`: the session is loaded on `init()` or the first method that needs it (`checkAuthentication()`, `login()`, ...)                                                      |
| `serverSessionUri`       | `string \| boolean \| null`                         | No       | `null`            | Routes login requests through your server and enables server-managed sessions; `false` / `null` keeps client-managed sessions. The Server SDK defaults it to `` `${authUriPrefix}/login` ``; see [Server-side session management](#server-side-session-management) |
| `authUriPrefix`          | `string`                                             | No       | `'/auth'`         | URL prefix of the Server SDK auth routes. With server-managed sessions `refresh()` navigates the browser to `${authUriPrefix}/refresh` with `returnTo` set to the current URL (or `refresh({ returnTo })`), so the server rotates the session cookie and redirects back; see [Refreshing the session](#refreshing-the-session) |
| `logging`                | `SDKLogging`                                         | No       | -                 | Logging adapter; see [Logging](#logging)                                                                                                                   |
| `httpClient`             | `SDKHttpClient`                                      | No       | fetch             | Custom HTTP client adapter; see [HTTP client](#http-client)                                                                                                |
| `discoveryDocumentCacheTTL`       | `number`                                             | No       | `3600`            | OIDC metadata cache duration in seconds (1 hour by default)                                                                                                |
| `jwksCacheTTL`           | `number`                                             | No       | `600`             | JWKS (JSON Web Key Set) cache duration in seconds (10 minutes by default)                                                                                  |
| `uriHandler`             | `(url, params?) => Promise<unknown>`                 | No       | -                 | Custom handler for URL redirects (e.g. to integrate with a router instead of `window.location`)                                                            |
| `callbackHandler`        | `(url, responseMode?) => Promise<unknown>`           | No       | -                 | Custom handler for processing the authorization server callback URL                                                                                        |
| `factory`                | `(options: SDKInitConfig) => unknown`                | No       | -                 | Custom flow factory; when set, `initFlow` calls it with the options instead of the built-in flows - see [Custom flow](#custom-flow)                       |

---

### Configuration examples

#### uriHandler

Override the default redirect behavior (which uses `window.location`) to integrate with client-side routers or custom navigation logic.

```ts
// Capacitor InAppBrowser example
import { Capacitor } from '@capacitor/core';
import { InAppBrowser } from '@capgo/inappbrowser';

const sdk = initFlow({
	// ... other config
	uriHandler: async (url) => {
		if (Capacitor.getPlatform() === 'web') {
			// On web: use standard window.location redirect
			window.location.href = url;
		} else {
			// On native (iOS/Android): open in InAppBrowser
			await InAppBrowser.openInWebView({
				url,
				options: { /* Configure InAppBrowser options*/ },
			});
		}
	},
});
```

#### callbackHandler

Override the default callback URL parsing to handle custom redirect flows or extract the callback URL from a non-standard location.

```ts
// Capacitor InAppBrowser callback handling
import { Capacitor } from '@capacitor/core';
import { InAppBrowser } from '@capgo/inappbrowser';
import type { PluginListenerHandle } from '@capacitor/core';

const sdk = initFlow({
	// ... other config
	callbackHandler: async (url, responseMode) => {
		if (Capacitor.getPlatform() === 'web') {
			// On web: use default callback handling
			const urlObj = new URL(window.location.href);
			const params = responseMode === 'fragment'
				? new URLSearchParams(urlObj.hash.slice(1))
				: urlObj.searchParams;

			return {
				code: params.get('code'),
				state: params.get('state'),
				error: params.get('error'),
				error_description: params.get('error_description'),
			};
		}

		// On native: listen for navigation events in InAppBrowser
		return new Promise(async (resolve, reject) => {
			let navigationListener: PluginListenerHandle | null = null;
			let finishListener: PluginListenerHandle | null = null;
			let userCancelled = true;

			const cleanupListeners = async () => {
				if (navigationListener) {
					await navigationListener.remove();
					navigationListener = null;
				}
				if (finishListener) {
					await finishListener.remove();
					finishListener = null;
				}
			};

			try {
				// Listen for page navigation in InAppBrowser
				navigationListener = await InAppBrowser.addListener(
					'browserPageNavigationCompleted',
					async (event) => {
						const navigatedUrl = event.url;

						// Check if the navigated URL matches our callback URL
						if (navigatedUrl && navigatedUrl.startsWith(url)) {
							try {
								const urlInstance = new URL(navigatedUrl);
								const dataString = responseMode === 'query'
									? urlInstance.search
									: urlInstance.hash;
								const params = Object.fromEntries(
									new URLSearchParams(dataString.slice(1))
								);

								userCancelled = false;
								await InAppBrowser.close();
								resolve(params);
							} catch (error) {
								await InAppBrowser.close();
								reject(error);
							}
						}
					}
				);

				// Listen for browser close event
				finishListener = await InAppBrowser.addListener('browserClosed', async () => {
					await cleanupListeners();

					if (userCancelled) {
						reject(new Error('InAppBrowser flow cancelled by user.'));
					}
				});
			} catch (error) {
				await cleanupListeners();
				reject(error);
			}
		});
	},
});
```

---

### Caching

The SDK automatically caches OIDC metadata and JWKS (JSON Web Key Set) to reduce network requests and improve performance.

#### Metadata caching

OIDC metadata (authorization endpoint, token endpoint, etc.) is fetched from the `issuer` URL during SDK initialization and cached for **1 hour**.

The cache is shared across all SDK instances with the same `issuer` URL and stored in memory for the lifetime of the application.

#### JWKS caching

The JSON Web Key Set (used for ID token signature verification) is fetched from the `jwks_uri` endpoint and cached for **10 minutes**.

```ts
// First token verification: fetches JWKS from the IDP
await sdk.handleCallback(); // Verifies ID token signature

// Within 10 minutes: reuses cached JWKS (no network request)
await sdk.refresh(); // Verifies new ID token signature using cached keys

// After 10 minutes: refetches JWKS from the IDP
await sdk.refresh(); // Fetches fresh keys if cache expired
```

The JWKS cache is also shared across all SDK instances with the same `jwks_uri` and stored in memory.

#### Configuring cache durations

You can customize the cache durations by passing `discoveryDocumentCacheTTL` and `jwksCacheTTL` options (in seconds) during SDK initialization:

```ts
const sdk = initFlow({
	mode: 'redirect',
	issuer: 'https://<YOUR_TENANT_DOMAIN>',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile', 'email'],
	discoveryDocumentCacheTTL: 7200, // Cache openID configuration for 2 hours instead of 1 hour
	jwksCacheTTL: 1800, // Cache JWKS for 30 minutes instead of 10 minutes
});
```

---

## Migration guide

### Migrating to v4.0

v4 replaces the SDK's class-based flow architecture with function-based architecture, and adds first-class support for server-managed (BFF) sessions. `initFlow` itself and all built-in `redirect`/`popup`/`embedded`/`native` flow methods (`login`, `register`, `handleCallback`, `refresh`, `revoke`, `logout`, `subscribeToEvent`, ...) are unchanged - only apps that used `mode: 'custom'` or drove `native` mode through the old `NativeFlowHandler` need to update their code.

#### Class-based flows replaced by functions

In v3, flows were classes (`RedirectFlow`, `PopupFlow`, `NativeFlow`, `EmbeddedFlow`), and the only way to customize behavior - for example, to proxy authentication through your own backend - was `mode: 'custom'` with a `customFlow` class that extended one of them and override its methods:

```ts
// v3
import { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';

export class CustomNativeFlow extends NativeFlow {
	override async refresh(): Promise<void> {
		// ...
	}
}

const sdk = initFlow({ mode: 'custom', customFlow: CustomNativeFlow /* ... */ });
```

v4 removes `mode: 'custom'` and the `customFlow` option entirely, along with the flow classes and deep imports used to extend them. In their place, `createBaseFlow` is a factory function that returns a plain object of methods closing over shared state - build your own flow by composing it, without extending anything:

```ts
// v4
import { createBaseFlow } from '@strivacity/sdk-core/flows/base';
import { getDefaultFlowState, getSDKOptions } from '@strivacity/sdk-core/utils';

export function createCustomFlow(initConfig: SDKInitConfig) {
	const state = getDefaultFlowState();
	const options = getSDKOptions(initConfig);
	const base = createBaseFlow(state, options);

	async function refresh(): Promise<void> {
		// ...
	}

	return { ...base, refresh };
}
```

See [Custom flow](#custom-flow) above for the full pattern.

#### Server-managed sessions ([BFF](../../README.md#bff)) are now built in

In v3, routing authentication through your own backend meant writing a custom flow class like the one above yourself: manually calling `fetch()` against hand-written endpoints, and reimplementing PKCE/state handling, CSRF protection, and server-side token storage on your own.

v4 replaces v3's approach with a first-class **Server SDK** and a single client-side option. Set `serverSessionUri` on your existing SDK options and the built-in `redirect`/`popup`/`embedded`/`native` flows automatically route login through your server (instead of the identity provider) with tokens kept server-side instead of in client storage:

```ts
// v4
const sdk = initFlow({
	mode: 'redirect',
	issuer: 'https://<YOUR_TENANT_DOMAIN>',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile', 'email'],
	serverSessionUri: '/api/auth/login', // requests are routed through your server; tokens are never written to client storage
});
```

Pair it with `createBaseServerSDK` from `@strivacity/sdk-core/server` on the backend - PKCE, state, and session storage are all handled by the Server SDK. See [Server-side session management](#server-side-session-management) and [Server SDK](#server-sdk) above, and the [backend example app](../../apps/backend) for a working reference.

#### Native mode: no more `NativeFlowHandler`

In v3, `native` mode's `login()`/`register()` returned a separate `NativeFlowHandler` instance, and the flow was driven through that handler:

```ts
// v3
const handler = await sdk.login();
const state = await handler.startSession(sessionId);
const nextState = await handler.submitForm('formId', { identifier: 'user@example.com' });
await handler.finalizeSession(nextState.finalizeUrl);
```

v4 moves `startSession()`, `submitForm()`, and `finalizeSession()` directly onto the flow instance itself - there's no separate handler object to manage:

```ts
// v4
const state = await sdk.startSession({ sessionId });
const nextState = await sdk.submitForm('formId', { identifier: 'user@example.com' });
// When nextState.finalizeUrl is set, submitForm() has already finalized the session - no finalizeSession() call needed
```

See [native mode](#client-native-mode) above for the full rendering loop. Update any code that calls `login()`/`register()` and drives the returned handler to call `sdk.startSession()`/`sdk.submitForm()`/`sdk.finalizeSession()` directly instead. Framework-specific wrappers already wrap this for you.

#### Other breaking changes

- **`mode` is required.** v3 defaulted to `redirect` when `mode` was omitted; v4 throws `UnsupportedFlowError` (see [Unsupported flow error](#unsupported-flow-error)).
- **`storage`, `logging`, and `httpClient` take plain objects instead of classes.** v3 expected constructors (`storage: LocalStorage`, `logging: MyLogger`) that it instantiated itself; v4 expects instances, e.g. `storage: createLocalStorage()`, `logging: createDefaultLogging()`. The `SDKStorage`/`SDKLogging`/`SDKHttpClient` abstract classes are now plain types, and `SDKStorageType`/`SDKLoggingType`/`SDKHttpClientType` were removed.
- **Custom HTTP clients must implement `sendTokenRequest`** in addition to `request`, and the optional logger property was renamed from `logging` to `logger` (see [HTTP client](#http-client)).
- **Error classes are no longer exported from the package root.** Import them from `@strivacity/sdk-core/utils` instead of `@strivacity/sdk-core`.
- **Events are scoped per SDK instance.** In v3, event subscriptions were shared across all flow instances; in v4 each instance has its own subscribers.
- **PKCE / login state is stored in `stateStorage`** (default: `createSessionStorage()`), separately from the session `storage`. v3 stored it in the session storage.
- **`waitToInitialize()` was replaced by `init()`.**
- **`urlHandler` was renamed to `uriHandler`**, and the built-in `redirectUrlHandler` / `popupUrlHandler` to `redirectUriHandler` / `popupUriHandler`.
- **`storageTokenName` was renamed to `storageKey`.** The default is still `'sty.session'`, so existing sessions are kept unless you customized it.
- **Type renames:** `LoginFlowState` → `NativeFlowState`, `LoginFlowMessage` → `NativeFlowMessage`, `MetadataOptions` → `DiscoveryDocument`.

### Migrating to v3.0

##### Entry API Major Changes
`sdk.entry()` API now returns a structured object instead of a plain string. Check the example above in the usage section for more details.

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
