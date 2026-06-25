# @strivacity/sdk-core

Framework-agnostic JavaScript/TypeScript client for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to any web application with no framework dependencies.

Use it directly in vanilla JS/TS projects or use one of the [framework-specific wrappers](https://docs.strivacity.com/reference/javascript-sdks).

## Table of contents

- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Initialization](#initialization)
- [Login flows](#login-flows)
  - [redirect](#redirect)
  - [popup](#popup)
  - [embedded](#embedded)
  - [native](#native)
  - [Custom login session URI](#custom-login-session-uri)
- [Session state](#session-state)
- [Stateless session storages](#stateless-session-storages)
- [SDK events](#sdk-events)
- [Logging](#logging)
- [HTTP client](#http-client)
- [Custom flow](#custom-flow)
- [My Account API](#my-account-api)
- [Configuration reference](#configuration-reference)

---

## Prerequisites

- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

## Installation

```bash
npm install @strivacity/sdk-core
```

---

## Choosing a mode

| Mode       | Login UI                                 | Best for                                     |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `redirect` | Strivacity hosted page                   | Standard web apps                            |
| `popup`    | Strivacity hosted page in a popup        | SPAs that must stay on the current page      |
| `embedded` | Strivacity web components in your page   | Branded login inside your own layout         |
| `native`   | Your own components driven by flow state | Full UI control, step-by-step form rendering |

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where the login UI lives and how the flow state is consumed.

---

## Initialization

`initFlow` returns with the flow instance. By default session loading from storage starts immediately in the background. With `lazyLoad: true` it is deferred until the first SDK method call. If you need the session to be available before proceeding, call `await sdk.init()` explicitly.

```ts
// sdk.ts
import { initFlow } from '@strivacity/sdk-core';

// Default - session loading starts in the background immediately
const sdk = initFlow({
	mode: 'redirect',
	issuer: 'https://YOUR_TENANT.strivacity.com',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile', 'email'],
});

// Wait for the session to be loaded from storage before proceeding
await sdk.init();
```

```ts
// sdk.ts

// Lazy - session loading is deferred until the first SDK method call
const sdk = initFlow({
	mode: 'redirect',
	issuer: 'https://YOUR_TENANT.strivacity.com',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile', 'email'],
	lazyLoad: true,
});
```

---

## Login flows

### redirect

The current window navigates to the Strivacity-hosted login page and back after authentication.

#### Login

```ts
import { sdk } from './sdk';

await sdk.login({
	// Optional parameters
	loginHint: 'user@example.com', // pre-fill the identifier field
	acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
	audiences: ['https://api.example.com'], // extra access token audiences
});
```

#### Handle the callback

Call this on your redirect URI page after the IDP sends the user back. It exchanges the authorization code for tokens and stores the session.

```ts
import { sdk } from './sdk';

// the page at your redirectUri
await sdk.handleCallback();
globalThis.location.href = '/';
```

#### Logout

```ts
import { sdk } from './sdk';

await sdk.logout({ postLogoutRedirectUri: globalThis.location.origin });
```

#### Token management

```ts
import { sdk } from './sdk';

// Refresh the access token using the refresh token
await sdk.refresh();

// Revoke all tokens at the authorization server and clear the local session
await sdk.revoke();

// Get the current access token (auto-refreshes if expired and refresh token is present)
const token = await sdk.getAccessToken();

// Get the access token without auto-refresh
const token = await sdk.getAccessToken({ autoRefresh: false });
```

---

### popup

The Strivacity login page opens in a separate window. After authentication the window closes and the parent page receives the session — no full-page navigation required.

#### Login

```ts
import { sdk } from './sdk';

await sdk.login();
```

By default a centered popup window opens. Pass `popupWindowTarget` to change where the window opens, and `popupWindowFeatures` to control its size and chrome:

```ts
import { sdk } from './sdk';

await sdk.login();

// Custom popup size and position
await sdk.login({
	// Optional parameters
	loginHint: 'user@example.com', // pre-fill the identifier field
	acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
	audiences: ['https://api.example.com'], // extra access token audiences
	popupWindowTarget: '_blank', // any valid browsing context name
	popupWindowFeatures: {
		width: 500,
		height: 700,
		left: 100,
		top: 100,
		toolbar: false,
		location: false,
		resizable: true,
		scrollbars: true,
	},
});
```

#### Handle the callback

The popup resolves automatically — no callback page is needed. Token exchange happens inside the popup and the result is posted back to the opener.

#### Logout

```ts
import { sdk } from './sdk';

await sdk.logout({ postLogoutRedirectUri: globalThis.location.origin });
```

#### Token management

```ts
import { sdk } from './sdk';

// Refresh the access token using the refresh token
await sdk.refresh();

// Revoke all tokens at the authorization server and clear the local session
await sdk.revoke();

// Get the current access token (auto-refreshes if expired and refresh token is present)
const token = await sdk.getAccessToken();

// Get the access token without auto-refresh
const token = await sdk.getAccessToken({ autoRefresh: false });
```

---

### embedded

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your cluster once during application bootstrap, alongside SDK initialization:

```ts
import { initFlow } from '@strivacity/sdk-core';
import 'https://<YOUR_TENANT_DOMAIN>/assets/components/bundle.js';

const sdk = initFlow({
	mode: 'embedded',
	issuer: 'https://YOUR_TENANT.strivacity.com',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile', 'email'],
});
```

#### Login

In embedded mode `sty-login` does not take `issuer`, `clientId`, or `redirectUri` as attributes - those come from the SDK configuration above. Place it on your login page together with `sty-notifications` (toast-style system notifications) and `sty-language-selector` (a language switcher for the login flow):

```ts
import { sdk } from './sdk';

// Mount your web components - they drive themselves from here
// <sty-notifications></sty-notifications>
// <sty-login></sty-login>
// <sty-language-selector></sty-language-selector>
```

The `sty-login` element dispatches `login`, `close`, and `error` custom events. Listen to them and react accordingly:

```ts
const login = document.querySelector('sty-login');

login.addEventListener('login', () => {
	// User authenticated - navigate to a protected page
	globalThis.location.href = globalThis.location.origin;
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

#### Controlling when the flow starts

By default the login flow starts automatically as soon as `sty-login` connects to the DOM. Add the `lazy` attribute to take manual control, then call `start()` when ready:

```ts
// <sty-login id="login" lazy></sty-login>

const login = document.getElementById('login');
await login.start();
```

`start()` accepts an optional params object forwarded to the authorization request. The same values can be set as a `params` property before the component mounts, which is useful when they're known ahead of time:

```ts
await login.start({
	loginHint: 'user@example.com', // pre-fill the identifier field
	acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
	uiLocales: ['en-US'],
	prompt: 'create', // use 'create' to open the registration flow instead
});

// or, before the component is inserted into the DOM
login.params = { loginHint: 'user@example.com', uiLocales: ['fr-FR'] };
await login.start();
```

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), call `entry()` on the landing page. It resolves the flow parameters from the IDP (`session_id`, `short_app_id`, `language`) and returns them. Pass them directly to the `sty-login` web component on the same page — no separate redirect needed.

```ts
import { sdk } from './sdk';

const data = await sdk.entry();

// Mount your web components with the resolved parameters
// <sty-notifications></sty-notifications>
// <sty-login sessionId="data.session_id" shortAppId="data.short_app_id" language="data.language"></sty-login>
// <sty-language-selector></sty-language-selector>

document.querySelector('sty-login').addEventListener('login', () => {
	globalThis.location.href = globalThis.location.origin;
});
```

---

### native

You build the entire login UI with your own components. Call `startSession()` directly on the SDK instance to get the initial `LoginFlowState`, render the widgets, submit each form step with `submitForm()`, and repeat until `state.finalizeUrl` is set — then call `finalizeSession()`.

For the full state shape and widget reference see the [Rendering reference](https://docs.strivacity.com/reference/rendering-reference).

#### Login page

```ts
import { sdk } from './sdk';

const state = await sdk.startSession();
```

#### Submitting a form step

```ts
const nextState = await sdk.submitForm('identifier', {
	identifier: 'user@example.com',
});

if (nextState.finalizeUrl) {
	await sdk.finalizeSession(nextState.finalizeUrl);
	globalThis.location.href = '/';
} else {
	// Re-render for nextState.screen
}
```

#### Minimal rendering loop example

The current step's widgets live in `state.forms` (an array of `{ id, widgets }`), grouped by form. Rendering order and grouping come from `state.layout` - a tree of `{ type: 'vertical' | 'horizontal', items }`, where each `item` is either a nested layout or `{ type: 'widget', formId, widgetId }` pointing at a widget inside `state.forms`.

```ts
function findWidget(state: LoginFlowState, formId: string, widgetId: string) {
	const form = state.forms?.find((f) => f.id === formId);
	return form?.widgets.find((w) => w.id === widgetId);
}

function renderItems(state: LoginFlowState, items: LoginFlowState['layout'] extends { items: infer I } ? I : never, form: HTMLFormElement) {
	for (const item of items ?? []) {
		if (item.type !== 'widget') {
			// Nested vertical/horizontal group - recurse into its items
			renderItems(state, item.items, form);
			continue;
		}

		const widget = findWidget(state, item.formId, item.widgetId);
		if (!widget) continue;

		if (widget.type === 'input' || widget.type === 'password') {
			const input = document.createElement('input');
			input.name = widget.id;
			input.type = widget.type === 'password' ? 'password' : 'text';
			if ('value' in widget && widget.value) input.value = String(widget.value);
			form.appendChild(input);
		} else if (widget.type === 'submit') {
			const btn = document.createElement('button');
			btn.type = 'submit';
			btn.textContent = widget.label ?? 'Continue';
			form.appendChild(btn);
		}
	}
}

async function renderStep(state: LoginFlowState) {
	if (state.finalizeUrl) {
		await sdk.finalizeSession(state.finalizeUrl);
		globalThis.location.href = '/';
		return;
	}

	const formId = state.layout?.items?.[0]?.type === 'widget' ? state.layout.items[0].formId : undefined;
	const form = document.createElement('form');

	renderItems(state, state.layout?.items, form);

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const data = Object.fromEntries(new FormData(form));
		renderStep(await sdk.submitForm(formId!, data));
	});

	document.body.replaceChildren(form);
}

renderStep(state);
```

#### Externally-initiated flows (entry)

Same as embedded mode: call `sdk.entry()` on the landing page to resolve the flow parameters, then pass them to `startSession()`.

```ts
import { sdk } from './sdk';

const data = await sdk.entry();
const state = await sdk.startSession({ sessionId: data?.session_id, language: data?.language });
```

#### Overriding session start and finalize

Pass `startSessionHandler` or `finalizeSessionHandler` in the `initFlow` options to replace the built-in logic entirely — useful when all authentication traffic must go through a BFF:

```ts
const sdk = initFlow({
	mode: 'native',
	issuer: 'https://YOUR_TENANT.strivacity.com',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',

	startSessionHandler: async (params) => {
		await fetch('/api/auth/start', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		});
	},

	finalizeSessionHandler: async (url) => {
		await fetch('/api/auth/finalize', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ finalizeUrl: String(url) }),
		});
	},
});
```

> When `startSessionHandler` or `finalizeSessionHandler` is provided the built-in IDP call and state tracking are skipped entirely — your handler owns the full start and finalize logic.

---

### Custom login session URI

All four modes accept an optional `loginSessionUri` parameter (in `login()`/`register()` for `redirect`/`popup`, in `startSession()` for `embedded`/`native`) to start the flow through your own server-side endpoint (e.g. a BFF) instead of the SDK's default IDP endpoint - useful when the request must be built/signed server-side. Sensitive OAuth2 parameters are never sent to `loginSessionUri` - your endpoint is responsible for adding those itself; only the non-sensitive extras (`prompt`, `display`, `acrValues`, `loginHint`, `uiLocales`, `audiences`) are appended as query params.

```ts
// redirect / popup
await sdk.login({ loginSessionUri: '/api/auth/login' });

// embedded
const loginComponent = document.createElement('sty-login');
loginComponent.params = { loginSessionUri: '/api/auth/login/session' };
document.body.appendChild(loginComponent);

// native
await sdk.startSession({ loginSessionUri: '/api/auth/login/session' });
```

---

## Session state

All flow instances expose the same set of getters:

```ts
// Async - waits for init, optionally auto-refreshes an expired token
const isAuthenticated: boolean = await sdk.isAuthenticated;

// Sync - true only if a non-expired session is already in memory
const isAuthenticated: boolean = sdk.isAuthenticatedSync;

// Token values (available synchronously after init)
const accessToken: string | null = sdk.accessToken;
const refreshToken: string | null = sdk.refreshToken;
const idTokenClaims: IdTokenClaims | null = sdk.idTokenClaims;

// Expiry
const expired: boolean = sdk.accessTokenExpired;
const expiresAt: number | null = sdk.accessTokenExpirationDate; // Unix seconds

// Managed access token retrieval with optional auto-refresh
const token = await sdk.getAccessToken();
const token = await sdk.getAccessToken({ autoRefresh: false });

// Check authentication without triggering side effects
const ok: boolean = await sdk.checkAuthentication();
const ok: boolean = await sdk.checkAuthentication({ autoRefresh: false });
```

---

## Stateless session storages

Tokens and session data are stored entirely on the client side. The default storage is `localStorage`, but you can swap it out by passing any of the built-in factory functions — or any object implementing `SDKStorage` (`get`, `set`, `delete`) — as the `storage` option in `initFlow`.

| Storage          | Export                        | Persists across                                  |
| ---------------- | ----------------------------- | ------------------------------------------------ |
| `localStorage`   | `createLocalStorage()`        | browser restarts                                 |
| `sessionStorage` | `createSessionStorage()`      | tab lifetime                                     |
| `IndexedDB`      | `createIndexedDBStorage()`    | browser restarts, larger quota                   |
| `Cookie`         | `createCookieStorage(opts?)`  | configurable expiry                              |
| `Cache API`      | `createCacheAPIStorage()`     | browser restarts; works in Service Workers too   |
| `Memory`         | `createMemoryStorage()`       | page lifetime only                               |
| `Worker`         | `createWorkerStorage(worker)` | depends on the backing storage inside the Worker |

### Cookie storage

Stores the session in a browser cookie. Useful when you need configurable expiry, cross-subdomain sharing, or want the session to be sent automatically with server requests.

```ts
import { initFlow, createCookieStorage } from '@strivacity/sdk-core';

const sdk = initFlow({
	// ...
	storage: createCookieStorage({
		maxAge: 2592000, // seconds; omit for a session cookie
		path: '/',
		sameSite: 'Lax', // 'Strict' | 'Lax' | 'None'
		secure: true, // required when sameSite: 'None'
		domain: '.example.com', // omit to scope to the current host
	}),
});
```

### Worker storage

Offloads all storage operations to a `Worker` via `postMessage`, keeping tokens off the main thread. Create the Worker yourself and call `handleWorkerStorageRequests(storage)` inside it.

```ts
// storage.worker.ts
import { handleWorkerStorageRequests, createIndexedDBStorage } from '@strivacity/sdk-core';

handleWorkerStorageRequests(createIndexedDBStorage());
```

```ts
import { initFlow, createWorkerStorage } from '@strivacity/sdk-core';

const worker = new Worker(new URL('./storage.worker.ts', import.meta.url), { type: 'module' });

const sdk = initFlow({
	// ...
	storage: createWorkerStorage(worker),
});
```

---

## SDK events

Subscribe to authentication lifecycle events via `subscribeToEvent` (one specific event) or `subscribeToAllEvents` (all events). Both return a `{ dispose() }` handle - call `dispose()` to unsubscribe.

| Event                | Payload                                 | When it fires                                                             |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `init`               | -                                       | SDK has finished initializing                                             |
| `sessionLoaded`      | `{ accessToken, refreshToken, claims }` | An existing session was read from storage on startup                      |
| `loginInitiated`     | -                                       | A login or registration redirect / popup has started                      |
| `loggedIn`           | `{ accessToken, refreshToken, claims }` | Tokens were received and stored after a successful login                  |
| `logoutInitiated`    | `{ idToken, claims }`                   | Logout was initiated, before the redirect to the IDP end-session endpoint |
| `tokenRefreshed`     | `{ accessToken, refreshToken, claims }` | Access token was silently refreshed                                       |
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

## Logging

### Built-in logger

Call `createDefaultLogging()` to get a console logger with per-request correlation ID support:

```ts
import { initFlow } from '@strivacity/sdk-core';
import { createDefaultLogging } from '@strivacity/sdk-core/utils';

const sdk = initFlow({
	// ...
	logging: createDefaultLogging(),
});
```

### Custom logger

Implement the `SDKLogging` interface:

```ts
import type { SDKLogging } from '@strivacity/sdk-core';

class MyLogger implements SDKLogging {
	/** Set by the SDK per request; use to correlate related log lines */
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

	error(message: string, error?: unknown): void {
		console.error(this.xEventId ? `[${this.xEventId}] ${message}` : message, error);
	}
}

const sdk = initFlow({ /* ... */ logging: new MyLogger() });
```

---

## HTTP client

The SDK uses `fetch` for all requests. Replace it by implementing the `SDKHttpClient` interface and passing an instance via `httpClient` (it's a plain object shape, not a class - `request` and `sendTokenRequest` are both required, so it's easiest to wrap the built-in `createHttpClient()` and override just what you need). Useful for attaching custom headers to every request, routing traffic through a proxy, or using a platform-specific transport (e.g. Capacitor's `CapacitorHttp`).

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

## Custom flow

For cases where none of the built-in modes fit-for example, when all authentication traffic must go through a backend-for-frontend (BFF) server - you can build a completely custom flow on top of `createBaseFlow`.

`createBaseFlow` is the internal factory used by all built-in flows. It gives you the full shared method set (`init`, `getAccessToken`, `checkAuthentication`, `refresh`, `revoke`, `logout`, `handleCallback`, `getSession`, `updateSession`, `cleanupSession`, `subscribeToEvent`, `subscribeToAllEvents`, `tokenExchange`) and lets you add your own login logic on top.

```ts
import type { SDKInitConfig, SDKOptions } from '@strivacity/sdk-core';
import { createBaseFlow } from '@strivacity/sdk-core/flows/base';
import { getDefaultFlowState, getSDKOptions } from '@strivacity/sdk-core/utils/oidc';

export function createBFFFlow(initConfig: SDKInitConfig) {
	const state = getDefaultFlowState();
	const options = getSDKOptions<SDKOptions>(state, initConfig);
	const base = createBaseFlow(state, options);
	const { dispatchEvent: _, ...exposedBase } = base;

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
			await base.cleanupSession();
			base.dispatchEvent('tokenRefreshFailed', [{}]);
			return;
		}

		const session = await response.json();
		await base.updateSession(session);
		base.dispatchEvent('tokenRefreshed', [{ accessToken: session.access_token, claims: session.claims }]);
	}

	async function logout(): Promise<void> {
		await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
		await base.cleanupSession();
	}

	return {
		...exposedBase,
		login,
		refresh,
		logout,
	};
}
```

#### Usage:

```ts
const sdk = createBFFFlow({
	mode: 'native',
	issuer: 'https://YOUR_TENANT.strivacity.com',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://your-app.example.com/callback',
	scopes: ['openid', 'profile'],
});

await sdk.login();
```

---

## My Account API

The My Account API lets authenticated users manage their own profile, identifiers, authenticators, and account data. All functions are exported from `@strivacity/sdk-core/utils/myaccount` and require an `options` object (the same `SDKOptions` instance passed to `initFlow`) and a valid `token` (access token of the authenticated user).

Every function returns the raw `HttpClientResponse<T>` (the same shape as `SDKHttpClient.request()`) - call `.json()` on it to get the parsed payload, e.g. `const { data } = await (await myAccount.fetchAccountData({ token, options })).json();`.

```ts
import * as myAccount from '@strivacity/sdk-core/utils/myaccount';

const token = await sdk.getAccessToken();
const options = sdk.options; // SDKOptions instance

// Profile
const accountData = await myAccount.fetchAccountData({ token, options });
await myAccount.updateAccountData({ data: { given_name: 'Jane', family_name: 'Doe' }, token, options });

// Attributes
const attributes = await myAccount.fetchAttributes({ token, language: 'en-US', options });

// Account info
const info = await myAccount.fetchAccountInfo({ token, options });

// Application launchers
const launchers = await myAccount.fetchApplicationLaunchers({ token, options });

// Identifiers (email, phone, username)
const identifiers = await myAccount.fetchEnabledIdentifiers({ token, language: 'en-US', options });
const identities = await myAccount.fetchIdentities({ token, options });
await myAccount.sendIdentifierUpdateChallenge({ type: 'email', identifier: 'new@example.com', token, language: 'en-US', options });
await myAccount.updateIdentifier({ type: 'email', identifier: 'new@example.com', challenge: '123456', token, options });
await myAccount.unlinkExternalIdentifier({ id: 'identity-id', token, options });

// Authenticators
const supported = await myAccount.fetchSupportedAuthenticators({ token, options });
const list = await myAccount.fetchAuthenticators({ token, options });
const { uri } = await (await myAccount.fetchSoftTokenAuthenticatorURI({ token, options })).json();
await myAccount.sendAuthenticatorCreationChallenge({ target: 'user@example.com', type: 'email', token, language: 'en-US', options });
await myAccount.createAuthenticator({ target: 'user@example.com', type: 'email', challenge: '123456', token, options });
await myAccount.updateAuthenticatorMethod({ id: 'authenticator-id', methods: ['passcode', 'magicLink'], token, options });
await myAccount.sendAuthenticatorDeletionChallenge({ id: 'authenticator-id', token, language: 'en-US', options });
await myAccount.deleteAuthenticator({ id: 'authenticator-id', challenge: '123456', token, options });

// Passkeys
const creationOptions = await myAccount.sendPasskeyCreationChallenge({ target: 'My passkey', token, options });
await myAccount.createPasskey({ target: 'My passkey', challenge: registrationResponse, token, options });
await myAccount.sendPasskeyDeletionChallenge({ id: 'passkey-id', token, options });
await myAccount.deletePasskey({ id: 'passkey-id', challenge: authenticationResponse, token, options });

// Password
const policy = await myAccount.fetchPasswordPolicy({ token, options });
await myAccount.changePassword({ currentPassword: '...', newPassword: '...', token, options });

// Notification preferences
const descriptor = await myAccount.fetchNotificationPreferenceDescriptor({ token, language: 'en-US', options });
const preferences = await myAccount.fetchNotificationPreferences({ token, options });
await myAccount.updateNotificationPreferences({ preferences: { marketing: false }, token, options });

// Sessions
const sessions = await myAccount.fetchSessions({ token, options });
await myAccount.deleteSession({ sessionId: 'session-id', token, options });

// Consents
const consents = await myAccount.fetchConsents({ token, language: 'en-US', options });
await myAccount.optInConsent({ consentId: 'consent-id', token, options });
await myAccount.optOutConsent({ consentId: 'consent-id', receiptId: 'receipt-id', token, options });

// Account data export
const downloadUrl = myAccount.buildDownloadAccountDataUrl({ fileType: 'json', options });
const exportData = await myAccount.downloadAccountData({ fileType: 'json', token, language: 'en-US', options });

// Account deletion
await myAccount.deleteAccount({ token, language: 'en-US', options });
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
| `storage`                | `SDKStorage`                                         | No       | `localStorage`    | Session storage; see [Stateless session storages](#stateless-session-storages)                                                                             |
| `stateStorage`           | `SDKStorage`                                         | No       | same as `storage` | OAuth2 PKCE / state storage                                                                                                                                |
| `storageTokenName`       | `string`                                             | No       | `'sty.session'`   | Key under which the session is stored in the storage                                                                                                       |
| `autoRefresh`            | `boolean`                                            | No       | `true`            | Automatically refreshes the access token before it expires. Set to `false` to manage refresh manually                                                      |
| `lazyLoad`               | `boolean`                                            | No       | `false`           | When `true`, defers initialization until the first method call and returns the instance synchronously                                                      |
| `serverSideSession`      | `boolean`                                            | No       | `false`           | Set to `true` when session storage is managed server-side (tokens are not written to client storage)                                                       |
| `loginUri`               | `string`                                             | No       | `'/login'`        | URI of the app's login page; used in `embedded` and `native` modes to redirect the user when a new login is required                                       |
| `logging`                | `SDKLogging`                                         | No       | -                 | Logging adapter; see [Logging](#logging)                                                                                                                   |
| `httpClient`             | `SDKHttpClient`                                      | No       | fetch             | Custom HTTP client adapter; see [HTTP client](#http-client)                                                                                                |
| `getMetadata`            | `() => Promise<MetadataOptions>`                     | No       | -                 | Overrides the built-in OIDC discovery fetch. Called once and cached; useful for providing metadata from a BFF instead of fetching it directly from the IDP |
| `urlHandler`             | `(url, params?) => Promise<unknown>`                 | No       | -                 | Custom handler for URL redirects (e.g. to integrate with a router instead of `globalThis.location`)                                                        |
| `callbackHandler`        | `(url, responseMode?) => Promise<unknown>`           | No       | -                 | Custom handler for processing the authorization server callback URL                                                                                        |
| `startSessionHandler`    | `(params: Record<string, unknown>) => Promise<void>` | No       | -                 | Overrides the built-in session start logic for `embedded` and `native` modes                                                                               |
| `finalizeSessionHandler` | `(url: string \| URL) => Promise<void>`              | No       | -                 | Overrides the built-in session finalize logic for `embedded` and `native` modes                                                                            |

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
