# @strivacity/sdk-core

## Example App

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/web-component)

### Install

```bash
npm install @strivacity/sdk-core
```

### Usage

```js
import { initFlow } from '@strivacity/sdk-core';

const sdk = initFlow({
	mode: 'redirect', // or 'popup' or 'native'
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
});

await sdk.login();
```

### API Documentation

#### `initFlow(options: SDKOptions & { mode?: 'popup' | 'redirect' | 'native' }): PopupFlow | RedirectFlow | NativeFlow`

The `initFlow` function initializes and returns an instance of either `PopupFlow`, `RedirectFlow`, or `NativeFlow`, based on the specified `mode`.

**Parameters:**

- `options`: An object containing configuration options for the SDK.

  **Type:** `SDKOptions & { mode?: 'popup' | 'redirect' | 'native' }`

  **Properties:**

  - `issuer` (string): The issuer URL of the OpenID Provider.
  - `clientId` (string): The client identifier for the application.
  - `redirectUri` (string): The URI to redirect to after authentication.
  - `scopes` (Array<string>): The scopes to request during authentication.
  - `responseType` (ResponseType): The response type requested from the OpenID Provider.
  - `responseMode` (ResponseMode): The response mode to use.
  - `storageTokenName` (string): The name of the token in storage.
  - `storage` (SDKStorageType): A custom storage implementation.

  **Mode:**

  - `popup`: Uses a popup window for authentication. Returns an instance of `PopupFlow`.
  - `redirect`: Uses a full-page redirect for authentication. Returns an instance of `RedirectFlow`.
  - `native`: Uses a native flow for authentication. Returns an instance of `NativeFlow`.

## Custom native flow

You can use the `NativeFlowHandler` class if there is no existing Strivacity implementation for your JavaScript framework, or if you want to build a fully custom authentication flow.

If you are looking for example implementations for different frameworks, visit [packages](https://github.com/Strivacity/sdk-js/tree/main/packages).

### Usage

```js
import { initFlow } from '@strivacity/sdk-core';

const sdk = initFlow({
	mode: 'native',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
});

// This will return with a `NativeFlowHandler` instance
const handler = await sdk.login();

// Start a new session or resume an existing one
const state = await handler.startSession();

if (state.finalizeUrl) {
	// If the response contains a finalize URL, you can finalize the session
	await handler.finalizeSession(state.finalizeUrl);
} else {
	// Handle the response as needed
	console.log('Form submitted successfully:', state);
}

// Submit a form in the native flow
const formState = await handler.submitForm('formId', {
	// Your form data here
});

if (state.finalizeUrl) {
	// If the response contains a finalize URL, you can finalize the session
	await handler.finalizeSession(state.finalizeUrl);
} else {
	// Handle the response as needed
	console.log('Form submitted successfully:', state);
}
```

---

### API Documentation

#### `startSession(sessionId?: string | null): Promise<LoginFlowState | void>`

Starts a new authentication session. If a `sessionId` is provided, resumes the session; otherwise, initiates a new one.

#### `submitForm(formId?: string, body?: Record<string, unknown>): Promise<LoginFlowState>`

Submits a form in the native flow. Optionally specify a form ID and request body.

#### `finalizeSession(finalizeUrl: string): Promise<void>`

Finalizes the session using the provided URL. You can gather the finalize URL from the `LoginFlowState` returned by `startSession` or `submitForm`.

---

## Event Subscription

The SDK provides an event subscription system that allows you to listen to various authentication lifecycle events.

### Usage

```js
import { initFlow } from '@strivacity/sdk-core';

const sdk = initFlow({
	mode: 'redirect',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
});

// Subscribe to events
function updateSession(eventData) {
	console.log('Event received:', eventData);
	// Handle the event as needed
}

sdk.subscribeToEvent('init', updateSession);
sdk.subscribeToEvent('loggedIn', updateSession);
sdk.subscribeToEvent('sessionLoaded', updateSession);
sdk.subscribeToEvent('tokenRefreshed', updateSession);
sdk.subscribeToEvent('tokenRefreshFailed', updateSession);
sdk.subscribeToEvent('logoutInitiated', updateSession);
sdk.subscribeToEvent('tokenRevoked', updateSession);
sdk.subscribeToEvent('tokenRevokeFailed', updateSession);
```

### Available Events

- **`init`**: Fired when the SDK is initialized
- **`loggedIn`**: Fired when a user successfully logs in
- **`sessionLoaded`**: Fired when an existing session is loaded
- **`tokenRefreshed`**: Fired when access tokens are successfully refreshed
- **`tokenRefreshFailed`**: Fired when token refresh fails
- **`logoutInitiated`**: Fired when logout process is initiated
- **`tokenRevoked`**: Fired when tokens are successfully revoked
- **`tokenRevokeFailed`**: Fired when token revocation fails

### API Documentation

#### `subscribeToEvent(eventType: string, callback: (eventData: any) => void): void`

Subscribe to SDK events to handle authentication state changes.

**Parameters:**

- `eventType` (string): The type of event to listen for
- `callback` (function): The function to call when the event is fired
