# @strivacity/sdk-core

A framework-agnostic JavaScript/TypeScript client that integrates Strivacity's policy-driven authentication journeys into any application using the OAuth 2.0 PKCE flow. Supports `redirect`, `popup`, `native`, and `embedded` modes.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

This SDK provides the core authentication primitives for Strivacity's policy-driven journeys. It is a standalone JavaScript/TypeScript library with no framework dependencies that can be used directly or as the foundation for framework-specific SDKs (React, Vue, Angular, etc.). The SDK uses the OAuth 2.0 PKCE flow to authenticate with Strivacity.

## Demo Application

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/web-component)

## Install

```bash
npm install @strivacity/sdk-core
```

## Usage

### Initialization

Create a flow instance using the `initFlow` factory function:

```js
import { initFlow } from '@strivacity/sdk-core';

const sdk = initFlow({
	mode: 'redirect', // or 'popup', 'native', 'embedded'
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
});
```

### Redirect / Popup mode

In `redirect` mode the user is taken to the identity provider in the same window; in `popup` mode authentication happens in a popup. Both are initiated the same way from code.

#### Login

```js
await sdk.login();
```

#### Callback handling

Process the authorization callback after the identity provider redirects back to your application:

```js
await sdk.handleCallback();
```

#### Logout

The `postLogoutRedirectUri` parameter is optional and specifies where users are redirected after logout. This URI must be configured in the Admin Console as an allowed post-logout redirect URI.

```js
await sdk.logout({ postLogoutRedirectUri: location.origin });
```

#### Token refresh

Refreshes the access token using the stored refresh token, keeping the session alive without requiring the user to log in again.

```js
await sdk.refresh();
```

#### Token revocation

Revokes the current access and refresh tokens on the server, invalidating the session immediately.

```js
await sdk.revoke();
```

### Native mode

In `native` mode, `login()` returns a `NativeFlowHandler` instance that drives the authentication UI step by step.

#### Login page example

The login page extracts `session_id` and optionally `language` from the URL on load and passes them to `startSession()` to resume an existing flow or start a new one. When a `language` parameter is present it overrides `uiLocales` to display the authentication UI in the specified language:

```js
import { initFlow } from '@strivacity/sdk-core';

const sdk = initFlow({
	mode: 'native',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
});

// Returns a NativeFlowHandler instance
const handler = await sdk.login();

// Extract session_id from URL if present
const url = new URL(window.location.href);
const sessionId = url.searchParams.get('session_id');

// Start a new session or resume an existing one
const state = await handler.startSession(sessionId);

if (state.finalizeUrl) {
	// Finalize the session when the flow is complete
	await handler.finalizeSession(state.finalizeUrl);
} else {
	// Render the form from state.widgets and handle user input
	console.log('Current form state:', state);
}
```

#### Submitting a form

```js
const formState = await handler.submitForm('formId', {
	email: 'user@example.com',
	password: 'secret',
});

if (formState.finalizeUrl) {
	await handler.finalizeSession(formState.finalizeUrl);
}
```

#### Callback page example

When a `session_id` is present in the URL the native flow is resumed by forwarding it to the login page. Otherwise the standard `handleCallback()` path is used:

```js
const url = new URL(location.href);
const sessionId = url.searchParams.get('session_id');

if (sessionId) {
	// Forward to login page with session_id to resume the native flow
	window.location.href = `/login?session_id=${sessionId}`;
} else {
	try {
		await sdk.handleCallback();
		window.location.href = '/profile';
	} catch (error) {
		console.error('Error during callback handling:', error);
	}
}
```

#### Entry page example

The entry page processes flows started by an external process (e.g. password reset) by calling `entry()` to extract the necessary parameters to resume the flow:

```js
try {
	const data = await sdk.entry();

	if (data && Object.keys(data).length > 0) {
		window.location.href = `/callback?${new URLSearchParams(data).toString()}`;
	} else {
		window.location.href = '/';
	}
} catch (error) {
	console.error('Entry failed:', error);
	window.location.href = '/';
}
```

### Custom mode

Custom mode lets you replace the built-in flow implementations with your own classes. This is useful when you need to proxy authentication through a backend server (BFF pattern) rather than communicating with the identity provider directly from the browser.

Pass `mode: 'custom'` together with a `customFlow` class that extends one of the built-in flow base classes (`NativeFlow`, `EmbeddedFlow`, etc.):

```ts
import { initFlow } from '@strivacity/sdk-core';
import { CustomNativeFlow } from './sdk/CustomNativeFlow';

const sdk = initFlow({
	mode: 'custom',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
	customFlow: CustomNativeFlow,
});
```

#### Creating a custom flow class

Extend `NativeFlow` (or `EmbeddedFlow`) and override the methods you need to change. The example below delegates session management to a backend API instead of calling the identity provider directly:

```ts
import type { NativeParams } from '@strivacity/sdk-core';
import { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import { Session } from '@strivacity/sdk-core/utils/Session';
import { CustomNativeFlowHandler } from './CustomNativeFlowHandler';

export class CustomNativeFlow extends NativeFlow {
	override login(params: NativeParams = {}): CustomNativeFlowHandler {
		this.dispatchEvent('loginInitiated', []);
		return new CustomNativeFlowHandler(this, params);
	}

	override register(params: NativeParams = {}): CustomNativeFlowHandler {
		params.prompt = 'create';
		return this.login(params);
	}

	async fetchSessionData(): Promise<void> {
		const response = await this.httpClient.request(new URL('/api/session/info', location.origin).toString(), { method: 'GET', credentials: 'include' });

		this.session = Object.assign(new Session(), await response.json());

		if (!this.accessTokenExpired) {
			this.dispatchEvent('loggedIn', [{ claims: this.idTokenClaims! }]);
		}
	}

	override async refresh(): Promise<void> {
		const response = await this.httpClient.request(new URL('/api/session/refresh', location.origin).toString(), { method: 'POST', credentials: 'include' });

		if (!response.ok) {
			this.session = null;
			this.dispatchEvent('tokenRefreshFailed', [{}]);
			return;
		}

		this.session = Object.assign(new Session(), await response.json());
		this.dispatchEvent('tokenRefreshed', [{ claims: this.idTokenClaims! }]);
	}

	override async logout(): Promise<void> {
		this.dispatchEvent('logoutInitiated', []);

		await this.httpClient.request(new URL('/api/session/logout', location.origin).toString(), { method: 'POST', credentials: 'include' });

		this.session = null;
	}
}
```

#### Creating a custom flow handler

Extend `NativeFlowHandler` and override `startSession` and `finalizeSession` to communicate with your backend:

```ts
import type { LoginFlowState } from '@strivacity/sdk-core';
import { NativeFlowHandler } from '@strivacity/sdk-core/handlers/NativeFlowHandler';
import { CustomNativeFlow } from './CustomNativeFlow';

export class CustomNativeFlowHandler extends NativeFlowHandler {
	declare sdk: CustomNativeFlow;

	override async startSession(sessionId?: string | null): Promise<LoginFlowState | void> {
		if (sessionId) {
			this.sessionId = sessionId;
			return this.submitForm();
		}

		const response = await this.sdk.httpClient.request(new URL('/api/session/start', location.origin).toString(), {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(this.params),
		});

		const data = await response.json();
		this.sessionId = data.session_id;

		return this.submitForm();
	}

	override async finalizeSession(finalizeUrl: string): Promise<void> {
		const finalizeResponse = await this.sdk.httpClient.request(finalizeUrl, {
			method: 'GET',
			headers: { Authorization: `Bearer ${this.sessionId}` },
			credentials: 'include',
		});

		const redirectUri = new URL(await finalizeResponse.text());

		await this.sdk.httpClient.request(new URL('/api/session/finalize', location.origin).toString(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.sessionId}`,
			},
			body: JSON.stringify(Object.fromEntries(redirectUri.searchParams)),
			credentials: 'include',
		});

		await this.sdk.fetchSessionData();
	}
}
```

### Event subscription

The SDK provides an event system for listening to authentication lifecycle events:

```js
const { dispose } = sdk.subscribeToEvent('loggedIn', (eventData) => {
	console.log('User logged in:', eventData);
});

// Later: unsubscribe
dispose();
```

Available events:

- **`init`**: Fired when the SDK is initialized.
- **`loggedIn`**: Fired when a user successfully logs in.
- **`loginInitiated`**: Fired when a login flow is initiated.
- **`sessionLoaded`**: Fired when an existing session is loaded.
- **`accessTokenExpired`**: Fired when the access token expires.
- **`tokenRefreshed`**: Fired when access tokens are successfully refreshed.
- **`tokenRefreshFailed`**: Fired when token refresh fails.
- **`logoutInitiated`**: Fired when logout is initiated.
- **`tokenRevoked`**: Fired when tokens are successfully revoked.
- **`tokenRevokeFailed`**: Fired when token revocation fails.

## Logging

The SDK supports optional logging to help you debug authentication flows and monitor SDK behavior. You can enable the built-in console logger or provide your own custom logger implementation.

### Using the Default Logger

Enable the default console logger by adding the `logging` option when calling `initFlow`:

```js
import { initFlow, DefaultLogging } from '@strivacity/sdk-core';

const sdk = initFlow({
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
import type { SDKLogging } from '@strivacity/sdk-core';

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
import { initFlow } from '@strivacity/sdk-core';
import { MyLogger } from './logging/MyLogger';

const sdk = initFlow({
	// ...other options
	logging: MyLogger,
});
```

The `SDKLogging` interface requires `debug`, `info`, `warn`, and `error` methods. The optional `xEventId` property, when set by the SDK, provides a correlation ID to trace related log messages across the authentication flow.

## HTTP Client

The SDK uses a built-in `fetch`-based HTTP client for all requests. You can replace it with your own implementation by extending `SDKHttpClient` and passing your class via the `httpClient` option. This is useful when you need to attach custom headers (e.g. `x-sty-app-id`) to every outgoing request, route traffic through a proxy, or use a platform-specific transport such as Capacitor's `CapacitorHttp`.

### Adding custom headers to every request

```typescript
import { initFlow, SDKHttpClient, type HttpClientResponse } from '@strivacity/sdk-core';

class CustomHttpClient extends SDKHttpClient {
	async request<T>(url: string, options?: RequestInit): Promise<HttpClientResponse<T>> {
		const mergedOptions: RequestInit = {
			...options,
			headers: {
				'x-sty-app-id': 'my-app',
				...(options?.headers as Record<string, string>),
			},
		};

		const response = await fetch(url, mergedOptions);

		return {
			headers: response.headers,
			ok: response.ok,
			status: response.status,
			statusText: response.statusText,
			url: response.url,
			json: async () => (await response.json()) as T,
			text: async () => await response.text(),
		};
	}
}

const sdk = initFlow({
	// ...other options
	httpClient: CustomHttpClient,
});
```

Any header you add inside `request()` is automatically included in every SDK request

### CORS configuration

For custom request headers to reach the Strivacity cluster, the cluster must be configured to explicitly allow them. Add the header name(s) to the **Access-Control-Allow-Headers** list in the cluster settings. Without this, browsers will block the preflight `OPTIONS` request and the SDK call will fail with a CORS error.

```
Access-Control-Allow-Headers: x-sty-app-id, <any other custom headers>
```

## API Documentation

### `initFlow(options)`

```typescript
initFlow(options: SDKOptions): PopupFlow | RedirectFlow | NativeFlow | EmbeddedFlow
```

The `initFlow` function creates and returns a flow instance based on the `mode` specified in `options`.

**Parameters:**

| Name               | Type                                                          | Required | Description                                                                    |
| ------------------ | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `issuer`           | `string`                                                      | ✅       | The issuer URL of the OpenID Provider.                                         |
| `clientId`         | `string`                                                      | ✅       | The client identifier for the application.                                     |
| `redirectUri`      | `string`                                                      | ✅       | The URI to redirect to after authentication.                                   |
| `mode`             | `'redirect' \| 'popup' \| 'native' \| 'embedded' \| 'custom'` | ⬜       | The authentication flow mode. Defaults to `'redirect'`.                        |
| `scopes`           | `string[]`                                                    | ⬜       | The scopes to request. Defaults to `['openid']`.                               |
| `responseType`     | `'code' \| 'id_token'`                                        | ⬜       | The response type.                                                             |
| `responseMode`     | `'query' \| 'fragment'`                                       | ⬜       | The response mode.                                                             |
| `storageTokenName` | `string`                                                      | ⬜       | Custom name for the session storage key. Defaults to `'sty.session'`.          |
| `storage`          | `SDKStorageType`                                              | ⬜       | Custom storage implementation. Defaults to `LocalStorage`.                     |
| `httpClient`       | `SDKHttpClientType`                                           | ⬜       | Custom HTTP client implementation.                                             |
| `logging`          | `SDKLoggingType`                                              | ⬜       | Logging implementation class.                                                  |
| `customFlow`       | `FlowType`                                                    | ⬜       | Custom flow class. Required when `mode` is `'custom'`. Must extend `BaseFlow`. |

**Returns:** A flow instance (`PopupFlow`, `RedirectFlow`, `NativeFlow`, `EmbeddedFlow`, or your custom flow class) depending on the configured `mode`.

---

### Flow instance methods

All flow instances share the following methods:

- **`login(options?: LoginOptions): Promise<void | NativeFlowHandler>`**: Initiates login. In `native` mode returns a `NativeFlowHandler`.
- **`register(options?: RegisterOptions): Promise<void | NativeFlowHandler>`**: Initiates registration.
- **`entry(url?: string): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL and returns parameters needed to resume the flow.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback.
- **`refresh(): Promise<void>`**: Refreshes the session tokens.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out.
- **`subscribeToEvent(eventType: string, callback: Function): { dispose(): void }`**: Subscribes to an authentication lifecycle event. Returns an object with a `dispose()` method to unsubscribe.

**Session state getters:**

- **`isAuthenticated: Promise<boolean>`**: Resolves to `true` when a valid session exists.
- **`isAuthenticatedSync: boolean`**: Synchronous check for an active session.
- **`idTokenClaims: IdTokenClaims | null`**: Claims from the ID token.
- **`accessToken: string | null`**: The current access token.
- **`refreshToken: string | null`**: The current refresh token.
- **`accessTokenExpired: boolean`**: `true` when the access token has expired.
- **`accessTokenExpirationDate: number | null`**: Expiration timestamp (Unix seconds) of the access token.

---

### `NativeFlowHandler`

Returned by `NativeFlow.login()` and `NativeFlow.register()` to drive the step-by-step native authentication UI.

- **`startSession(sessionId?: string | null): Promise<LoginFlowState | void>`**: Starts a new authentication session or resumes an existing one when `sessionId` is provided.
- **`submitForm(formId?: string, body?: Record<string, unknown>): Promise<LoginFlowState>`**: Submits a form step in the authentication flow.
- **`finalizeSession(finalizeUrl: string): Promise<void>`**: Finalizes the session using the URL returned in `LoginFlowState.finalizeUrl`.

---

### `subscribeToEvent(eventType, callback)`

Subscribe to SDK lifecycle events.

**Parameters:**

| Name        | Type                       | Required | Description                              |
| ----------- | -------------------------- | -------- | ---------------------------------------- |
| `eventType` | `string`                   | ✅       | The event type to listen for.            |
| `callback`  | `(eventData: any) => void` | ✅       | The handler called when the event fires. |

**Returns:** `{ dispose(): void }` — call `dispose()` to unsubscribe.

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

@strivacity/sdk-core is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).

## Migrating to v3.0

### Entry API Major Changes

Strivacity SDK's `entry()` API now returns a structured object instead of a plain string. Check the example above in the usage section for more details.
