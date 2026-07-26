# @strivacity/sdk-preact

Preact SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Preact application.

> See the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/preact) for a complete, working reference implementation covering all four login modes.

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Quick start](#quick-start)
- [Login flows](#login-flows)
  - [redirect](#redirect-mode)
  - [popup](#popup-mode)
  - [embedded](#embedded-mode)
  - [native](#native-mode)
  - [Custom login session URI](#custom-login-session-uri)
- [Hooks API](#hooks-api)
- [Session storages](#session-storages)
- [SDK events](#sdk-events)
- [My Account API](#my-account-api)
- [Configuration reference](#configuration-reference)

---

## Prerequisites

- Preact 10+
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-preact
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

## Quick start

### 1. Wrap your app with `StyAuthProvider`

`StyAuthProvider` initializes the SDK and provides the auth context to every component in the tree via Preact context - mount it once near the root of your app.

```tsx
// main.tsx
import { render } from 'preact';
import { StyAuthProvider, createDefaultLogging } from '@strivacity/sdk-preact';
import { App } from './components/App';

render(
	<StyAuthProvider
		options={{
			mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native'
			issuer: 'https://YOUR_TENANT.strivacity.com',
			clientId: 'YOUR_CLIENT_ID',
			redirectUri: 'https://your-app.example.com/callback',
			scopes: ['openid', 'profile', 'email'],
			logging: createDefaultLogging(),
		}}
	>
		<App />
	</StyAuthProvider>,
	document.getElementById('app')!,
);
```

### 2. Use the auth state

Call `useStrivacity()` in any component to read the current authentication state and trigger login or logout.

```tsx
import { useStrivacity } from '@strivacity/sdk-preact';

export function App() {
	const { loading, isAuthenticated, idTokenClaims, login, logout } = useStrivacity();

	if (loading) {
		return null;
	}

	return isAuthenticated ? (
		<div>
			<span>Hello, {idTokenClaims?.given_name}</span>
			<button onClick={() => logout()}>Log out</button>
		</div>
	) : (
		<button onClick={() => login()}>Log in</button>
	);
}
```

### 3. Guard authenticated routes

Wrap a page component with `withAuthGuard` to redirect unauthenticated users to the login page automatically.

```tsx
// pages/Profile.tsx
import { withAuthGuard } from '@strivacity/sdk-preact';

export default withAuthGuard(function Profile() {
	return <section>Protected content</section>;
});
```

---

## Login flows

### redirect mode

The user is redirected to the Strivacity-hosted login page and back after authentication.

```tsx
import { useEffect } from 'preact/hooks';
import { useStrivacity } from '@strivacity/sdk-preact';

export default function Login() {
	const { loading, login } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		void login({
			// Optional parameters
			loginHint: 'user@example.com', // pre-fill the identifier field
			acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
			audiences: ['https://api.example.com'], // extra access token audiences
		});
	}, [loading, login]);

	return (
		<section>
			<p>Loading...</p>
		</section>
	);
}
```

#### Handle the callback

Call this on your redirect URI page after the IDP sends the user back.

```tsx
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useStrivacity } from '@strivacity/sdk-preact';

export default function Callback() {
	const { loading, handleCallback } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		handleCallback()
			.then(() => route('/profile'))
			.catch((error) => route(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`));
	}, [loading]);

	return (
		<section>
			<h1>Logging in...</h1>
		</section>
	);
}
```

### popup mode

The Strivacity login page opens in a separate window. After the user authenticates the popup closes and the parent page receives the session automatically - no callback page needed.

Configuration is the same as `redirect` - just set `mode: 'popup'`. `login()` opens the popup automatically; pass `popupWindowTarget`/`popupWindowFeatures` to control its size and position.

### embedded mode

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`) - `sty-notifications` shows toast-style system notifications and `sty-language-selector` lets the user switch the login flow's language. Load the components bundle with `injectScript`, then mount the elements with a `ref` and assign object props (like `params`) imperatively, since custom elements can't receive complex props as JSX attributes:

```tsx
import type { LoginComponent } from '@strivacity/sdk-preact';
import { useEffect, useRef } from 'preact/compat';
import { route } from 'preact-router';
import { injectScript } from '@strivacity/sdk-preact';

const issuer = import.meta.env.VITE_ISSUER;

export default function Login() {
	const loginRef = useRef<LoginComponent>(null);

	useEffect(() => {
		// Load the web components bundle
		injectScript('sty-components', `${issuer}/assets/components/bundle.js`);
	}, []);

	useEffect(() => {
		const element = loginRef.current;

		if (!element) {
			return;
		}

		element.params = {};

		const onLogin = () => route('/profile');
		const onClose = () => globalThis.location.reload();
		const onError = (event: Event) => alert((event as CustomEvent<string>).detail);

		element.addEventListener('login', onLogin);
		element.addEventListener('close', onClose);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('close', onClose);
			element.removeEventListener('error', onError);
		};
	}, []);

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={loginRef}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

#### Controlling when the flow starts

By default the login flow starts automatically as soon as `sty-login` connects to the DOM. Add the `lazy` prop and call `start()` on the ref'd element when ready:

```tsx
<sty-login ref={loginRef} lazy></sty-login>
<button
	onClick={() =>
		loginRef.current?.start({
			loginHint: 'user@example.com', // pre-fill the identifier field
			acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
		})
	}
>
	Continue to login
</button>
```

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), call `entry()` on the landing page. It resolves the flow parameters from the IDP (`session_id`, `short_app_id`, `language`) - pass them directly to the `sty-login` element on the same page.

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { useStrivacity } from '@strivacity/sdk-preact';

export default function Entry() {
	const { entry } = useStrivacity();
	const [data, setData] = useState<Record<string, string>>();
	const loginRef = useRef<LoginComponent>(null);

	useEffect(() => {
		entry().then(setData);
	}, [entry]);

	useEffect(() => {
		if (loginRef.current && data) {
			loginRef.current.sessionId = data.session_id;
			loginRef.current.shortAppId = data.short_app_id;
			loginRef.current.lang = data.language;
		}
	}, [data]);

	return data ? <sty-login ref={loginRef}></sty-login> : null;
}
```

### native mode

You build the entire login UI with your own components using the `useNativeLogin` hook. It drives the flow state and returns a `LoginContext`: `loading`, `forms` (current field values), `messages` (validation/info messages), `state` (the current `LoginFlowState` - `screen`, `forms` widget definitions, `layout`, `finalizeUrl`, ...), `submitForm`, `setFormValue`, `setMessage`, `triggerFallback`, `triggerClose`.

`useNativeLogin` also publishes the context to any descendant component, which can read it with `useNativeLoginContext()` without prop drilling.

> The SDK does **not** ship ready-made widget components or a renderer for native mode - it only provides the state machine. Build your own widget components (or copy the ones from the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/preact/src/components/login)) that read/write state via `useNativeLoginContext()`, and a `WidgetRenderer` that walks `state.layout.items` (each item is either `{ type: 'widget', formId, widgetId }`, resolved by looking it up in `state.forms`, or a nested `{ type: 'vertical' | 'horizontal', items: [...] }` group) to decide what to render and in what order.

```tsx
import { route } from 'preact-router';
import { useNativeLogin } from '@strivacity/sdk-preact';
import { WidgetRenderer, widgets } from '../components/login';

export default function Login() {
	const ctx = useNativeLogin({
		params: {
			// Optional parameters
			loginHint: 'user@example.com',
			acrValues: ['urn:strivacity:loa:2'],
			audiences: ['https://api.example.com'],
		},
		onLogin: async () => {
			route('/profile');
		},
		onClose: () => {
			globalThis.location.reload();
		},
		// called when the native flow cannot continue (e.g. unsupported step) - fall back to the hosted login page
		onFallback: (error) => {
			globalThis.location.href = error.url.toString();
		},
		onError: async (error) => {
			route(`/error?error=${encodeURIComponent(error.message)}`);
		},
	});

	if (ctx.loading || !ctx.state.screen) {
		return (
			<section>
				<p>Loading...</p>
			</section>
		);
	}

	return (
		<section className="login-renderer">
			<widgets.layout formId={ctx.state.layout?.items?.[0]?.formId} type={ctx.state.layout?.type} tag="form">
				<WidgetRenderer items={ctx.state.layout?.items} />
			</widgets.layout>
		</section>
	);
}
```

#### Externally-initiated flows (entry)

Same as for embedded mode: call `sdk.entry()` (or read the query params from an `/entry`-style landing page) to resolve `session_id`/`short_app_id`/`language`, then pass them via `params` to `useNativeLogin`.

---

### Custom login session URI

All four modes accept an optional `loginSessionUri` parameter to start the flow through your own server-side endpoint (e.g. a BFF) instead of the SDK's default IDP endpoint - useful when the request must be built/signed server-side. Sensitive OAuth2 parameters (`client_id`, `redirect_uri`, `scope`, PKCE, ...) are never sent to `loginSessionUri` - your endpoint is responsible for adding those itself; only the non-sensitive extras (`prompt`, `display`, `acrValues`, `loginHint`, `uiLocales`, `audiences`) are appended as query params.

Pass it to `login()`/`register()` (`redirect`/`popup`) or as part of `params` to `useNativeLogin()` (`native`):

```tsx
import { useStrivacity, useNativeLogin } from '@strivacity/sdk-preact';

const { login } = useStrivacity();

// redirect / popup
await login({ loginSessionUri: '/api/auth/login' });

// native
useNativeLogin({ params: { loginSessionUri: '/api/auth/login/session' } });
```

> In `native` mode the SDK calls `loginSessionUri` through `sdk.httpClient` (instead of navigating the browser) to resolve the session parameters.

`embedded` mode supports the same parameter directly on the `sty-login` element - assign it via the element's `params` property instead of letting it build the default IDP request:

```tsx
useEffect(() => {
	if (loginRef.current) {
		loginRef.current.params = { loginSessionUri: '/api/auth/login/session' };
	}
}, []);
```

---

## Hooks API

### `useStrivacity<T>()`

The main hook. Returns the full auth context:

```ts
type SDKContext<Flow> = {
	sdk: Flow;
	loading: boolean;
	language: string;
	isAuthenticated: boolean;
	idTokenClaims: IdTokenClaims | null;
	accessToken: string | null;
	refreshToken: string | null;
	accessTokenExpired: boolean;
	accessTokenExpirationDate: number | null;
	init: () => Promise<void>;
	login(params?: NativeParams): Promise<void>;
	register(params?: NativeParams): Promise<void>;
	logout(params?: { postLogoutRedirectUri?: string }): Promise<void>;
	refresh(): Promise<void>;
	revoke(): Promise<void>;
	entry(url?: string | URL): Promise<Record<string, string>>;
	handleCallback(url?: string | URL): Promise<void>;
	checkAuthentication(opts?: { autoRefresh?: boolean }): Promise<boolean>;
	getAccessToken(opts?: { autoRefresh?: boolean }): Promise<string | null>;
	tokenExchange(...): Promise<...>;
	subscribeToEvent<T extends keyof EventFunctions>(eventName: T, callbackFn: EventFunctions[T]): { dispose(): void };
	subscribeToAllEvents(callbackFn: (...params: unknown[]) => Promise<void> | void): { dispose(): void };
};
```

The generic parameter `T` can be `RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow` for type-safe access to flow-specific properties on `sdk`.

### `useNativeLogin(options)`

Manages a native login flow session - see [native mode](#native-mode). Options: `params` (`NativeParams`), `onLogin`, `onFallback`, `onClose`, `onError`, `onGlobalMessage`.

### `useNativeLoginContext()`

Reads the `LoginContext` published by an ancestor `useNativeLogin()` call - throws if called outside of one. Used by widget components so they don't need the context passed down as props.

### `withAuthGuard(Component, options?)`

A higher-order component that waits for the SDK to finish loading, then redirects to the login page if the user is not authenticated. Options: `loginUri` (default `'/login'`), `onLoading` (render prop shown while loading/unauthenticated).

---

## Session storages

Tokens and session data are stored entirely on the client side. The default storage is `localStorage`, but you can swap it out by passing any of the built-in factory functions - or any object implementing `SDKStorage` (`get`, `set`, `delete`) - as the `storage` option.

| Storage          | Export                        | Persists across                                  |
| ---------------- | ----------------------------- | ------------------------------------------------ |
| `localStorage`   | `createLocalStorage()`        | browser restarts                                 |
| `sessionStorage` | `createSessionStorage()`      | tab lifetime                                     |
| `IndexedDB`      | `createIndexedDBStorage()`    | browser restarts, larger quota                   |
| `Cookie`         | `createCookieStorage(opts?)`  | configurable expiry                              |
| `Cache API`      | `createCacheAPIStorage()`     | browser restarts; works in Service Workers too   |
| `Memory`         | `createMemoryStorage()`       | page lifetime only                               |
| `Worker`         | `createWorkerStorage(worker)` | depends on the backing storage inside the Worker |

```tsx
import { StyAuthProvider, createCookieStorage } from '@strivacity/sdk-preact';

<StyAuthProvider
	options={{
		// ...
		storage: createCookieStorage({ maxAge: 2592000, sameSite: 'Lax' }),
	}}
>
	<App />
</StyAuthProvider>;
```

---

## SDK events

Subscribe to authentication lifecycle events via `subscribeToEvent` (one specific event) or `subscribeToAllEvents` (all events). Both return a `{ dispose() }` handle.

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

```tsx
const { subscribeToEvent } = useStrivacity();

useEffect(() => {
	const sub = subscribeToEvent('tokenRefreshed', ({ accessToken }) => {
		console.log('Token refreshed:', accessToken);
	});

	return () => sub.dispose();
}, [subscribeToEvent]);
```

---

## My Account API

The My Account API lets authenticated users manage their own profile, identifiers, authenticators, and account data. There is no Preact-specific wrapper - call the `@strivacity/sdk-core/utils/myaccount` functions directly with the access token and SDK options from `useStrivacity()`:

```tsx
import * as myAccount from '@strivacity/sdk-core/utils/myaccount';
import { useStrivacity } from '@strivacity/sdk-preact';

const { sdk } = useStrivacity();
const token = await sdk.getAccessToken();
const options = sdk.options;

const { attributes, data } = await myAccount.fetchAccountData({ token, options });
```

For the full method list see [`@strivacity/sdk-core` — My Account API](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core#my-account-api).

---

## Configuration reference

| Option              | Type                                              | Required | Default         | Description                                                                                             |
| ------------------- | ------------------------------------------------- | -------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `mode`              | `'redirect' \| 'popup' \| 'embedded' \| 'native'` | Yes      | -               | Authentication flow mode                                                                                |
| `issuer`            | `string`                                          | Yes      | -               | OIDC issuer URL of your Strivacity tenant                                                               |
| `clientId`          | `string`                                          | Yes      | -               | OAuth2 public client ID                                                                                 |
| `redirectUri`       | `string`                                          | Yes      | -               | OAuth2 redirect URI (must match your application configuration)                                         |
| `scopes`            | `string[]`                                        | No       | `['openid']`    | Requested OIDC scopes                                                                                   |
| `storage`           | `SDKStorage`                                      | No       | `localStorage`  | Session storage; see [Session storages](#session-storages)                                              |
| `storageTokenName`  | `string`                                          | No       | `'sty.session'` | Key under which the session is stored in the storage                                                    |
| `serverSideSession` | `boolean`                                         | No       | `false`         | Set to `true` when session storage is managed server-side (tokens are not written to client storage)    |
| `loginUri`          | `string`                                          | No       | `'/login'`      | URI of the app's login page; used in `embedded`/`native` modes to redirect when a new login is required |
| `autoRefresh`       | `boolean`                                         | No       | `true`          | Automatically refreshes the access token before it expires                                              |
| `lazyLoad`          | `boolean`                                         | No       | `false`         | When `true`, defers initialization until the first method call                                          |
| `logging`           | `SDKLogging`                                      | No       | -               | Logging adapter                                                                                         |
| `httpClient`        | `SDKHttpClient`                                   | No       | fetch           | Custom HTTP client adapter                                                                              |

For the full list of shared options see [`@strivacity/sdk-core` — Configuration reference](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core#configuration-reference).

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
