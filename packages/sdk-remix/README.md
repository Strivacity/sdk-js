# @strivacity/sdk-remix

Remix SDK for [Strivacity](https://www.strivacity.com) - adds authentication, session management, and self-service account management to your Remix application using OpenID Connect (OIDC).

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing an integration mode](#choosing-an-integration-mode)
- [Architecture: CSR and SSR](#architecture-csr-and-ssr)
- [Session storages](#session-storages)
- [Quick start - CSR](#quick-start--csr)
- [Quick start - SSR](#quick-start--ssr)
- [Login flows](#login-flows)
  - [redirect](#redirect-mode)
  - [popup](#popup-mode)
  - [embedded](#embedded-mode)
  - [native](#native-mode)
  - [Custom login session URI](#custom-login-session-uri)
- [Client API](#client-api)
- [Server API](#server-api)
- [Protecting routes](#protecting-routes)
- [Session lifecycle](#session-lifecycle)
- [SDK events](#sdk-events)
- [Back-channel logout](#back-channel-logout)
- [Configuration reference](#configuration-reference)

---

## Prerequisites

- **Remix 2 or later**, built on `@remix-run/node`
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)
- Node.js 20+

---

## Installation

```bash
npm install @strivacity/sdk-remix
```

`@strivacity/sdk-react` is bundled as a dependency of this package - its hooks are re-exported from `@strivacity/sdk-remix/client`, but its `StyAuthProvider` component is not re-exported and must be imported directly from `@strivacity/sdk-react` (see [Quick start - CSR](#quick-start--csr)).

> There is no top-level `@strivacity/sdk-remix` entry point - always import from the `/client`, `/server`, `/types`, or `/errors` subpaths.

---

## Choosing an integration mode

The SDK supports four login flow modes. Choose based on your UX and deployment requirements.

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where and how the login UI is rendered.

| Mode       | Login UI                                           | Default session storage                          | Best for                                   |
| ---------- | --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| `redirect` | Strivacity hosted page                             | Encrypted cookie (server)                        | Standard web apps                          |
| `popup`    | Strivacity hosted page in a popup                  | Encrypted cookie (server)                        | Apps that want to stay on the current page |
| `embedded` | Strivacity web components rendered inside your app | Encrypted cookie (server) or client localStorage | Branded login inside your own layout       |
| `native`   | Your own custom React components                   | Encrypted cookie (server) or client localStorage | Full UI control                            |

---

## Architecture: CSR and SSR

### CSR (Client-Side Rendering)

The SDK is initialized entirely in the browser. No server-side route is required. Multiple session storages are available out of the box — see [Session storages](#session-storages) for the full list and configuration examples. The default is `localStorage`.

Use `StyAuthProvider` from `@strivacity/sdk-react` to wrap your app.

**When to use:** Apps that render fully client-side, or situations where you don't want to manage sessions on the server.

### SSR (redirect / popup)

The SDK runs entirely on the server. By default sessions are stored using a **stateless, encrypted, HTTP-only cookie** — the client never sees raw tokens. `sdk.handler` handles the full OIDC flow (login, callback, logout, refresh, back-channel logout) and is mounted as the `loader`/`action` of a splat route. Protect individual routes with `sdk.withAuthGuard`/`sdk.withApiAuthRequired` - see [Protecting routes](#protecting-routes).

Any custom storage can be passed via the `storage` option in `createServerSDK` — it just needs to implement the `RemixServerStorage` interface. See [Session storages](#session-storages) for details and examples.

**When to use:** Apps using `redirect` or `popup` login mode where the login UI is hosted by Strivacity and no client-side auth state is needed beyond what loaders can read.

### SSR (embedded / native)

The `embedded` and `native` login modes render the login UI inside your own Remix app, which means the login route needs client-side interactivity. In these modes the server SDK still manages the session (same encrypted cookie as above), but you also need the client-side `StyAuthProvider` so that the login component can communicate with the SDK.

**embedded** - the login route renders Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). `sdk.handler` starts the login flow and handles the OAuth callback (token exchange and session cookie placement). See [embedded mode](#embedded-mode) for the full example.

**native** - the login route is built entirely with your own React components. Use the `useNativeLogin` hook, which drives the flow state (`loading`, `forms`, `messages`, `state`, `submitForm`, ...) and calls your `onLogin`/`onError`/`onFallback` callbacks as the flow progresses. See [native mode](#native-mode) for the full example.

In both cases, `StyAuthProvider` is mounted in the root layout (`app/root.tsx`). The server SDK still owns the session — the client provider is read-only context on top of it.

**When to use:** Apps where the login UI must live inside your own layout (`embedded`) or be built from scratch (`native`).

---

## Session storages

### Client-side (CSR)

Tokens and session data are stored entirely on the client side. The default storage is `localStorage`, but you can swap it out by passing any of the built-in factory functions — or any object implementing `SDKStorage` (`get`, `set`, `delete`) — as the `storage` option in `StyAuthProvider`.

All client storage exports come from `@strivacity/sdk-remix/client`.

| Storage          | Export                        | Persists across                                  |
| ---------------- | ------------------------------ | ------------------------------------------------ |
| `localStorage`   | `createLocalStorage()`        | browser restarts                                 |
| `sessionStorage` | `createSessionStorage()`      | tab lifetime                                     |
| `IndexedDB`      | `createIndexedDBStorage()`    | browser restarts, larger quota                   |
| `Cookie`         | `createCookieStorage(opts?)`  | configurable expiry                              |
| `Cache API`      | `createCacheAPIStorage()`     | browser restarts; works in Service Workers too   |
| `Memory`         | `createMemoryStorage()`       | page lifetime only                               |
| `Worker`         | `createWorkerStorage(worker)` | depends on the backing storage inside the Worker |

#### Cookie storage

Stores the session in a browser cookie. Useful when you need configurable expiry, cross-subdomain sharing, or want the session to be sent automatically with server requests.

```ts
// app/lib/auth/options.ts
import { createCookieStorage } from '@strivacity/sdk-remix/client';

export const sdkOptions = {
	// ...
	storage: createCookieStorage({
		maxAge: 2592000, // seconds; omit for a session cookie
		path: '/',
		sameSite: 'Lax', // 'Strict' | 'Lax' | 'None'
		secure: true, // required when sameSite: 'None'
		domain: '.example.com', // omit to scope to the current host
	}),
};
```

#### Worker storage

Offloads all storage operations to a dedicated `Worker` via `postMessage`, keeping tokens off the main thread. You create the Worker yourself and call `handleWorkerStorageRequests(storage)` inside it to wire up the message handler. `createIndexedDBStorage` and `createCacheAPIStorage` are the recommended backing stores inside a Worker since both APIs are natively available in that context.

```ts
// storage.worker.ts
import { handleWorkerStorageRequests, createIndexedDBStorage } from '@strivacity/sdk-remix/client';

handleWorkerStorageRequests(createIndexedDBStorage());
```

```ts
// app/lib/auth/options.ts
import { createWorkerStorage } from '@strivacity/sdk-remix/client';

const worker = new Worker(new URL('./storage.worker.ts', import.meta.url), { type: 'module' });

export const sdkOptions = {
	// ...
	storage: createWorkerStorage(worker),
};
```

### Server-side (SSR)

By default the server SDK stores sessions in a **stateless, encrypted, HTTP-only cookie** (`getEncryptedCookieStorage`). The cookie is AES-encrypted using the `secret` you provide and automatically chunked when the payload is too large for a single cookie.

| Storage          | Export                                     | Notes                                      |
| ---------------- | -------------------------------------------- | ------------------------------------------- |
| Encrypted cookie | `getEncryptedCookieStorage(secret, opts?)` | Default; AES-encrypted, HTTP-only, chunked |

Any custom backend can be passed via the `storage` option in `createServerSDK`. It must implement the `RemixServerStorage` interface (`get`, `set`, `delete`, `deleteByLogoutToken`).

#### Example: unstorage adapter

[unstorage](https://npmjs.com/package/unstorage) provides a unified async key-value API with dozens of built-in drivers (Redis, Cloudflare KV, filesystem, memory, and more). Wrap it to satisfy `RemixServerStorage`:

```ts
// app/lib/auth/storage.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import type { RemixServerStorage } from '@strivacity/sdk-remix/server';

const storage = createStorage({
	driver: redisDriver({ url: process.env.REDIS_URL }),
});

export const sessionStorage: RemixServerStorage = {
	async get(key) {
		return storage.getItem<string>(key);
	},
	async set(key, value) {
		await storage.setItem(key, value);
	},
	async delete(key) {
		await storage.removeItem(key);
	},
	// Required for OIDC back-channel logout support.
	// Scans all stored sessions and removes those matching the logout token's sid or sub claim.
	async deleteByLogoutToken(logoutToken) {
		const keys = await storage.getKeys();
		await Promise.all(
			keys.map(async (key) => {
				const raw = await storage.getItem<string>(key);
				if (!raw) return;
				const session = JSON.parse(raw);
				if ((logoutToken.sid && session.sid === logoutToken.sid) || (logoutToken.sub && session.sub === logoutToken.sub)) {
					await storage.removeItem(key);
				}
			}),
		);
	},
};
```

```ts
// app/lib/auth/server.ts
import { createServerSDK } from '@strivacity/sdk-remix/server';
import { sessionStorage } from './storage';

export const sdk = createServerSDK({
	// ...
	storage: sessionStorage,
});
```

---

## Quick start - CSR

### 1. Configure the SDK options

Define the core OIDC parameters your app will use. These values come from your Strivacity application configuration. The `mode` field controls which login flow the SDK uses.

```ts
// app/lib/auth/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-remix/types';

export const sdkOptions: SDKInitConfig = {
	mode: 'embedded', // 'redirect' | 'popup' | 'embedded' | 'native'
	issuer: 'https://YOUR_TENANT.strivacity.com', // OIDC issuer URL of your Strivacity tenant
	clientId: 'YOUR_CLIENT_ID', // OAuth2 public client ID
	redirectUri: 'https://YOUR_APP/auth/callback', // OAuth2 redirect URI registered in your app config
	scopes: ['openid', 'profile', 'email'], // requested OIDC scopes
	// storageTokenName: 'sty.session', // custom storage key for the session
};
```

### 2. Create the provider

Wrap the SDK options in a React component so the rest of the app can access auth state through context. `StyAuthProvider` comes from `@strivacity/sdk-react` - `@strivacity/sdk-remix/client` only re-exports the hooks and types built on top of it.

```tsx
// app/lib/auth/provider.tsx
import type { ReactNode } from 'react';
import { StyAuthProvider } from '@strivacity/sdk-react';
import { createDefaultLogging } from '@strivacity/sdk-remix/client';
import { sdkOptions } from './options';

export function AuthProvider({ children }: { children: ReactNode }) {
	return (
		<StyAuthProvider options={{ ...sdkOptions, logging: createDefaultLogging() }}>
			{children}
		</StyAuthProvider>
	);
}
```

### 3. Wrap your root layout

Mount `AuthProvider` in `app/root.tsx` so every route and component in the app can call `useStrivacity()`.

```tsx
// app/root.tsx
import { Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import { AuthProvider } from './lib/auth/provider';

export default function Root() {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</head>
			<body>
				<AuthProvider>
					<Outlet />
				</AuthProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
```

### 4. Use the auth state

Call `useStrivacity()` in any component to read the current authentication state and trigger login or logout. `loading` is `true` during the initial SDK setup - guard against rendering until it resolves.

```tsx
import { useStrivacity } from '@strivacity/sdk-remix/client';

export function Nav() {
	const { loading, isAuthenticated, idTokenClaims, login, logout } = useStrivacity();

	if (loading) return null;

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

---

## Quick start - SSR

### 1. Configure the SDK options

Same as in the CSR setup, with `serverSideSession: true` added to tell the SDK to store tokens on the server instead of in the browser.

```ts
// app/lib/auth/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-remix/types';

export const sdkOptions: SDKInitConfig = {
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native'
	issuer: 'https://YOUR_TENANT.strivacity.com', // OIDC issuer URL of your Strivacity tenant
	clientId: 'YOUR_CLIENT_ID', // OAuth2 public client ID
	redirectUri: 'https://YOUR_APP/auth/callback', // OAuth2 redirect URI registered in your app config
	scopes: ['openid', 'profile', 'email'], // requested OIDC scopes
	serverSideSession: true, // store the session on the server (required for SSR)
	// storageTokenName: 'sty.session', // custom key name for the session cookie
	// postLoginRedirectUri: '/', // where to send the user after a successful login
	// postLogoutRedirectUri: '/', // where to send the user after logout
	// authUrlPrefix: '/auth', // URL prefix for the SDK's built-in route handler
};
```

### 2. Create the server SDK instance

Instantiates the server-side SDK. The `secret` is used to encrypt the session cookie, so raw tokens never leave the server.

```ts
// app/lib/auth/server.ts
import { createServerSDK } from '@strivacity/sdk-remix/server';
import { sdkOptions } from './options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: 'YOUR_SECRET', // used to encrypt the session cookie
});
```

### 3. Mount the route handler

A single splat route delegates all auth traffic to the SDK. It handles login initiation, the OAuth2 callback (code exchange), logout, silent refresh, and back-channel logout - no custom logic needed.

```ts
// app/routes/auth.$.ts
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { sdk } from '../lib/auth/server';

export async function loader({ request }: LoaderFunctionArgs) {
	return sdk.handler(request);
}

export async function action({ request }: ActionFunctionArgs) {
	return sdk.handler(request);
}
```

### 4. Protect routes

There is no global middleware - wrap individual route `loader`s with `sdk.withAuthGuard` and individual resource routes with `sdk.withApiAuthRequired`. See [Protecting routes](#protecting-routes) for the full reference.

```tsx
// app/routes/profile.tsx
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { sdk } from '../lib/auth/server';

export const loader = sdk.withAuthGuard(async ({ session }) => {
	return json({ givenName: session.claims?.given_name });
});

export default function ProfilePage() {
	const { givenName } = useLoaderData<typeof loader>();
	return <p>Hello {givenName}</p>;
}
```

### 5. Create the client provider (optional)

Needed only if client components also need to read auth state (e.g. to show the user's name in a nav bar). The server session is passed as a prop so the client context is pre-populated on first render - no extra network request required.

```tsx
// app/lib/auth/provider.tsx
import type { ReactNode } from 'react';
import type { SessionData } from '@strivacity/sdk-remix/types';
import { StyAuthProvider } from '@strivacity/sdk-react';
import { sdkOptions } from './options';

export function AuthProvider({ session, children }: { session?: SessionData | null; children: ReactNode }) {
	return (
		<StyAuthProvider options={sdkOptions} session={session}>
			{children}
		</StyAuthProvider>
	);
}
```

Then pass the server session from the root loader:

```tsx
// app/root.tsx
import { json } from '@remix-run/node';
import { Outlet, Scripts, ScrollRestoration, useLoaderData } from '@remix-run/react';
import { sdk } from './lib/auth/server';
import { AuthProvider } from './lib/auth/provider';

export async function loader() {
	const session = await sdk.getSession();
	return json({ session });
}

export default function Root() {
	const { session } = useLoaderData<typeof loader>();

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</head>
			<body>
				<AuthProvider session={session}>
					<Outlet />
				</AuthProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
```

---

## Login flows

### redirect mode

The user is redirected to the Strivacity-hosted login page and then back to your app after authentication. Works in both CSR and SSR setups.

In **CSR** mode, calling `login()` from `useStrivacity()` starts the redirect.

In **SSR** mode, navigating to `/auth/login` (the default route handled by `sdk.handler`) starts the redirect. You can trigger this with a plain `<a href="/auth/login">` or a server redirect.

### popup mode

The Strivacity login page opens in a popup window. After the user authenticates, the popup closes and the parent page receives the session.

Configuration is the same as redirect - just set `mode: 'popup'`. In CSR mode `login()` opens the popup automatically.

### embedded mode

The Strivacity login UI renders **inside your own page** using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). `sty-notifications` shows toast-style system notifications and `sty-language-selector` lets the user switch the login flow's language. The SDK streams the login flow state to these components without any full-page redirect.

There are no React wrapper components for them - mount the raw custom elements, load the components bundle with `injectScript`, and use a `ref` to set properties and subscribe to the `login`/`close`/`error` custom events (JSX only reliably sets primitive props like `sessionId`/`lang` as attributes; object props like `params` and custom events must be wired imperatively):

```tsx
// app/routes/login.tsx
import type { LoginComponent } from '@strivacity/sdk-remix/client';
import { useEffect, useRef } from 'react';
import { useNavigate } from '@remix-run/react';
import { injectScript } from '@strivacity/sdk-remix/client';

const issuer = process.env.ISSUER;

export default function LoginPage() {
	const navigate = useNavigate();
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

		const onLogin = () => navigate('/profile');
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
	}, [navigate]);

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

In SSR mode the auth handler (`sdk.handler`) proxies the login flow from the IDP to the browser transparently. For a server-managed session, fetch `/auth/login/session` (handled by `sdk.handleLoginSession`) before mounting the component to obtain `session_id`/`short_app_id`/`language`, then set them on the `ref`'d element (`element.sessionId = ...`).

#### Externally-initiated flows (entry)

When a user clicks a link from an email (e.g. a password reset or invitation), the link contains a `challenge` that identifies an already-started IDP flow session. Point these links at `/auth/entry` - the handler resolves the challenge against the IDP, retrieves the active `session_id`, `short_app_id`, and `language` parameters, and redirects to the login page with those values as query parameters.

> Configure the destination in your Strivacity tenant to `https://your-app.example.com/auth/entry`. The login page URL is determined by the `loginUri` option (defaults to `/login`).

### native mode

You build the entire login UI with your own React components using the `useNativeLogin` hook. It drives the flow state and returns a `LoginContext`: `loading`, `forms` (current field values), `messages` (validation/info messages), `state` (the current `LoginFlowState` - `screen`, `forms` widget definitions, `layout`, `finalizeUrl`, ...), `submitForm`, `setFormValue`, `setMessage`, `triggerFallback`, `triggerClose`.

> The SDK does **not** ship ready-made widget components or a renderer for native mode - it only provides the state machine. Build your own widget components that read/write state via `useNativeLoginContext()`, and a `WidgetRenderer` that walks `state.layout.items` (each item is either `{ type: 'widget', formId, widgetId }`, resolved by looking it up in `state.forms`, or a nested `{ type: 'vertical' | 'horizontal', items: [...] }` group) to decide what to render and in what order.

#### Externally-initiated flows (entry)

Same as for embedded mode: point your Strivacity tenant's email link destination at `/auth/entry`. The handler resolves the challenge and redirects to the login page (`loginUri`) with `session_id`, `short_app_id`, and `language` as query parameters for `useNativeLogin` to resume the flow.

```tsx
// app/routes/login.tsx
import { useNavigate } from '@remix-run/react';
import { useNativeLogin } from '@strivacity/sdk-remix/client';
import { WidgetRenderer, widgets } from '../components/login';

export default function LoginPage() {
	const navigate = useNavigate();
	const searchParams = new URLSearchParams(globalThis?.window?.location.search);

	const ctx = useNativeLogin({
		params: {
			// Optional parameters
			loginHint: 'user@example.com', // pre-fill the identifier field
			acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
			audiences: ['https://api.example.com'], // extra access token audiences
			sessionId: searchParams.get('session_id'),
			language: searchParams.get('language'),
		},
		onLogin: async () => {
			navigate('/profile');
		},
		onClose: () => {
			globalThis.location.reload();
		},
		// called when the native flow cannot continue (e.g. unsupported step) - fall back to the hosted login page
		onFallback: (error) => {
			globalThis.location.href = error.url.toString();
		},
		// called when the flow fails to initialize
		onError: (error) => {
			navigate(`/error?error=${encodeURIComponent(error.message)}`);
		},
	});

	if (ctx.loading || !ctx.state.screen) {
		return <p>Loading...</p>;
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

### Custom login session URI

All four modes accept an optional `loginSessionUri` parameter to start the flow through your own server-side endpoint (e.g. a BFF) instead of the SDK's default IDP endpoint - useful when the request must be built/signed server-side. Sensitive OAuth2 parameters (`client_id`, `redirect_uri`, `scope`, PKCE, ...) are never sent to `loginSessionUri` - your endpoint is responsible for adding those itself; only the non-sensitive extras (`prompt`, `display`, `acrValues`, `loginHint`, `uiLocales`, `audiences`) are appended as query params.

In **CSR** mode, pass it to `login()`/`register()` (`redirect`/`popup`) or as part of `params` to `useNativeLogin()` (`native`):

```tsx
// redirect / popup
await login({ loginSessionUri: '/api/auth/login' });

// native
useNativeLogin({ params: { loginSessionUri: '/auth/login/session' } });
```

> In `native` mode the SDK calls `loginSessionUri` through `sdk.httpClient` (instead of navigating the browser) to resolve the session parameters - typically `/auth/login/session`, handled server-side by `sdk.handleLoginSession` in **SSR** setups.

`embedded` mode supports the same parameter directly on the `<sty-login>` element - set it via `params` on the `ref`'d element instead of letting it build the default IDP request:

```tsx
element.params = { loginSessionUri: '/auth/login/session' };
```

---

## Client API

All client exports come from `@strivacity/sdk-remix/client` (re-exported from `@strivacity/sdk-react`, except `StyAuthProvider` - see [Installation](#installation)).

### `StyAuthProvider`

Context provider from `@strivacity/sdk-react`. Must wrap the part of your component tree that uses auth.

```tsx
<StyAuthProvider options={options} session={serverSession}>
	{children}
</StyAuthProvider>
```

| Prop       | Type                          | Description                                                                 |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `options`  | `RemixAuthProviderInitConfig` | SDK configuration (see [Configuration reference](#configuration-reference)) |
| `session`  | `SessionData \| null`         | Optional session pre-fetched on the server (SSR setup)                     |
| `children` | `ReactNode`                   |                                                                             |

### `useStrivacity<T>()`

The main hook. Returns the full auth context.

```ts
type SDKContext<Flow> = {
	/** true while the SDK is initializing */
	loading: boolean;

	/** BCP 47 language code representing the current UI language */
	language: string;

	/** true if the user has an active authenticated session */
	isAuthenticated: boolean;

	/** decoded ID token claims, or null if not authenticated */
	idTokenClaims: IdTokenClaims | null;

	/** raw access token string, or null if not authenticated */
	accessToken: string | null;

	/** raw refresh token string, or null if not authenticated */
	refreshToken: string | null;

	/** true if the access token is past its expiration time */
	accessTokenExpired: boolean;

	/** Unix timestamp (seconds) when the access token expires, or null */
	accessTokenExpirationDate: number | null;

	/**
	 * Starts the login flow. With no arguments the user is sent to the standard login page.
	 * Pass `params` to pre-configure the authorization request.
	 */
	login(params?: {
		/**
		 * Controls the authorization server prompt behaviour:
		 * - `'login'`  – force re-authentication even if a session already exists on the IDP
		 * - `'create'` – go directly to the registration screen
		 */
		prompt?: string;
		/** Pre-fills the identifier (email / username) field on the login screen */
		loginHint?: string;
		/**
		 * Requested Authentication Context Class References.
		 * Use to require a specific assurance level, e.g. `['urn:strivacity:loa:2']`
		 */
		acrValues?: string[];
		/** Preferred UI languages for the IDP login page, in order of preference (e.g. `['hu-HU', 'en-US']`) */
		uiLocales?: string[];
		/**
		 * Extra audiences to include in the access token (`aud` claim).
		 * Use when the token must be accepted by a resource server beyond the default one.
		 */
		audiences?: string[];
	}): Promise<void>;

	/** Initiates the registration flow (shorthand for `login` with `prompt: 'create'`). Accepts the same parameters as `login()`. */
	register(params?: {
		/**
		 * Controls the authorization server prompt behaviour:
		 * - `'login'`  – force re-authentication even if a session already exists on the IDP
		 * - `'create'` – go directly to the registration screen
		 */
		prompt?: string;
		/** Pre-fills the identifier (email / username) field on the login screen */
		loginHint?: string;
		/**
		 * Requested Authentication Context Class References.
		 * Use to require a specific assurance level, e.g. `['urn:strivacity:loa:2']`
		 */
		acrValues?: string[];
		/** Preferred UI languages for the IDP login page, in order of preference (e.g. `['hu-HU', 'en-US']`) */
		uiLocales?: string[];
		/**
		 * Extra audiences to include in the access token (`aud` claim).
		 * Use when the token must be accepted by a resource server beyond the default one.
		 */
		audiences?: string[];
	}): Promise<void>;

	/**
	 * Ends the local session and redirects to the IDP end-session endpoint.
	 * After the IDP signs the user out, the browser is redirected to `postLogoutRedirectUri`
	 * (falls back to `postLogoutRedirectUri` from config, or the application origin).
	 */
	logout(params?: {
		/** Override the post-logout redirect URL for this specific call */
		postLogoutRedirectUri?: string;
	}): Promise<void>;

	/**
	 * Silently refreshes the access token using the stored refresh token.
	 * Has no effect if no refresh token is present.
	 *
	 * Fires `tokenRefreshed` on success or `tokenRefreshFailed` on error.
	 */
	refresh(): Promise<void>;

	/**
	 * Revokes all current tokens (access token + refresh token) at the authorization server,
	 * then clears the local session.
	 *
	 * Fires `tokenRevoked` on success or `tokenRevokeFailed` on error.
	 */
	revoke(): Promise<void>;

	/**
	 * Processes the entry-point URL in `embedded` or `native` mode.
	 * Call this on the landing page when an externally-initiated flow arrives (e.g. a link from an email).
	 * The SDK resolves the `challenge` in the URL against the IDP and returns the active session parameters.
	 * In SSR mode, externally-initiated flows are handled server-side by the `/auth/entry` route instead.
	 */
	entry(url?: string | URL): Promise<void>;

	/**
	 * Exchanges the authorization code in the callback URL for tokens and persists the session.
	 * Only needed in client-side rendering (CSR) `redirect` mode when the user is redirected back to your app after login. In SSR mode, the `/auth/callback` route handles this automatically.
	 */
	handleCallback(url?: string | URL): Promise<void>;

	/**
	 * Subscribes to a specific SDK lifecycle event.
	 * Returns a `{ dispose() }` handle — call `dispose()` to remove the listener.
	 * See [SDK events](#sdk-events) for a full list of available events and their payloads.
	 */
	subscribeToEvent<T extends keyof EventFunctions>(eventName: T, callbackFn: EventFunctions[T]): { dispose(): void };

	/**
	 * Subscribes to every SDK lifecycle event with a single callback.
	 * Returns a `{ dispose() }` handle — call `dispose()` to remove the listener.
	 */
	subscribeToAllEvents(callbackFn: (...params: unknown[]) => Promise<void> | void): { dispose(): void };

	/**
	 * the underlying SDK flow instance - use only when you need low-level access to properties not exposed as dedicated context fields
	 */
	sdk: Flow;
};
```

The generic parameter `T` can be `RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow` when you need type-safe access to flow-specific properties on `sdk`.

```tsx
import { type RedirectFlow, useStrivacity } from '@strivacity/sdk-remix/client';

export function UserMenu() {
	const { loading, isAuthenticated, idTokenClaims, login, logout } = useStrivacity<RedirectFlow>();

	if (loading) return null;

	if (!isAuthenticated) {
		return <button onClick={() => login()}>Log in</button>;
	}

	return (
		<div>
			<span>
				Hello, {idTokenClaims?.given_name} {idTokenClaims?.family_name}
			</span>
			<button onClick={() => logout()}>Log out</button>
		</div>
	);
}
```

### `withAuthGuard(Component)`

Client-side HOC that redirects unauthenticated users to the login page before rendering the wrapped component. Uses `useStrivacity()` internally.

```tsx
export default withAuthGuard(function ProfilePage() {
	const { idTokenClaims } = useStrivacity();
	return <p>Hello {idTokenClaims?.given_name}</p>;
});
```

---

## Server API

All server exports come from `@strivacity/sdk-remix/server`.

### `createServerSDK(config)`

Creates and returns the server SDK instance. Call this once and export it from a shared module (e.g. `app/lib/auth/server.ts`). See [Configuration reference](#configuration-reference) for all available options.

```ts
export const sdk = createServerSDK({
	mode: 'redirect',
	issuer: '...',
	clientId: '...',
	redirectUri: '...',
	scopes: ['openid', 'profile'],
	secret: 'YOUR_SECRET',
});
```

### `sdk.handler`

A universal Remix route handler. Mount it as the `loader` and `action` of a splat route (e.g. `app/routes/auth.$.ts`). It handles:

- `/auth/login` - initiates the authorization code flow
- `/auth/login/session` - proxies an **embedded**-mode login session request to the IDP server-side; used as the default `loginSessionUri` target for server-managed sessions
- `/auth/register` - same as `/auth/login` with `prompt=create`
- `/auth/callback` - exchanges the authorization code for tokens
- `/auth/refresh` - silently refreshes the session
- `/auth/revoke` - revokes the session tokens and redirects to the post-logout URI (without ending the IDP session)
- `/auth/entry` - handles externally-initiated flows (e.g. a password reset link from an email); processes the challenge, fetches the session parameters from the IDP, and redirects to the login page with `session_id`, `short_app_id`, and `language` as query params
- `/auth/logout` - initiates end-session
- `/auth/backchannel-logout` - handles OIDC back-channel logout

You can customize the prefix with the `authUrlPrefix` config option.

### `sdk.getSession(req?)`

Returns the `SessionData` for the current request, or `null` if no valid session exists. Can be called in loaders, actions, or resource routes.

```ts
// app/routes/profile.tsx
export async function loader() {
	const session = await sdk.getSession();

	if (!session?.access_token) {
		/* not authenticated */
	}
}
```

### `sdk.withAuthGuard(handler, opts?)`

Wraps a `loader` (or `action`) function. Redirects unauthenticated users to the login URL; when authenticated, calls `handler` with `{ req, session }`.

```ts
// app/routes/profile.tsx
export const loader = sdk.withAuthGuard(async ({ session }) => {
	return json({ accessToken: session.access_token });
});
```

### `sdk.withApiAuthRequired(handler)`

Wraps a resource route `loader`/`action`. Returns a `401` JSON response if no valid session is present.

```ts
// app/routes/api.data.ts
import { sdk } from '../lib/auth/server';
import { json } from '@remix-run/node';

export const loader = sdk.withApiAuthRequired(async (req) => {
	return json({ secret: 'data' });
});
```

---

## Protecting routes

There is no global middleware - protect individual routes explicitly:

### Via `withAuthGuard` (page route loader)

```ts
// app/routes/profile.tsx
export const loader = sdk.withAuthGuard(async ({ session }) => {
	return json({ givenName: session.claims?.given_name });
});
```

### Via `withAuthGuard` (Client Component)

```tsx
// app/routes/profile.tsx
export default withAuthGuard(function ProfilePage() {
	// only renders if authenticated
});
```

### Via `withApiAuthRequired` (resource route)

```ts
export const loader = sdk.withApiAuthRequired(async (req) => {
	// only reached if authenticated
});
```

---

## Session lifecycle

### Cookie expiry

The server SDK stores the session in an encrypted, HTTP-only cookie. The cookie lifetime is controlled by `cookieMaxAge` (default: `2592000` — 30 days). Set it to `0` for a session cookie that expires when the browser is closed.

```ts
export const sdk = createServerSDK({
	// ...
	cookieMaxAge: 3600, // 1 hour
});
```

### Token refresh

There is no automatic background refresh on the server - `getSession()` (and therefore `withAuthGuard`) only checks whether a session cookie exists, not whether its access token is still valid. Call `sdk.refreshSession()` (or hit the `/auth/refresh` route, handled by `sdk.handleRefresh`) explicitly when you need a fresh access token, e.g. before calling a downstream API. Set `cookieMaxAge` to control the outer session boundary; the individual access token lifetime is determined by the IDP.

If the refresh token has also expired, `refreshSession()`/`/auth/refresh` throws/responds accordingly and the user should be redirected to the login page.

### Post-login and post-logout redirect

By default the user is redirected to the application origin after login and logout. Override statically via config:

```ts
export const sdk = createServerSDK({
	postLoginRedirectUri: '/dashboard',
	postLogoutRedirectUri: '/',
});
```

To set the destination dynamically, pass `redirect_uri` (for login) or `post_logout_redirect_uri` (for logout) as a query parameter to the `/auth/login` or `/auth/logout` handler URLs. From a Client Component you can also pass it directly to `logout()`:

```tsx
const { logout } = useStrivacity();
<button onClick={() => logout({ postLogoutRedirectUri: '/bye' })}>Log out</button>;
```

---

## SDK events

The SDK emits lifecycle events you can listen to via `subscribeToEvent` (one specific event) or `subscribeToAllEvents` (all events). Both return a `{ dispose() }` handle — call `dispose()` to unsubscribe.

| Event                | Payload                                 | When it fires                                                            |
| -------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `init`               | —                                       | SDK has finished initializing                                            |
| `sessionLoaded`      | `{ accessToken, refreshToken, claims }` | An existing session was read from storage on startup                     |
| `loginInitiated`     | —                                       | A login or registration redirect / popup has started                     |
| `loggedIn`           | `{ accessToken, refreshToken, claims }` | Tokens were received and stored after a successful login                 |
| `logoutInitiated`    | `{ idToken, claims }`                   | Logout was initiated, before redirecting to the IDP end-session endpoint |
| `tokenRefreshed`     | `{ accessToken, refreshToken, claims }` | Access token was silently refreshed                                      |
| `tokenRefreshFailed` | `{ refreshToken }`                      | A token refresh attempt failed (refresh token may be expired)            |
| `accessTokenExpired` | `{ accessToken, refreshToken }`         | The stored access token has passed its expiration time                   |
| `tokenRevoked`       | `{ token, tokenTypeHint }`               | A token was successfully revoked at the authorization server             |
| `tokenRevokeFailed`  | `{ token, tokenTypeHint }`               | A token revocation attempt failed                                        |

```tsx
import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-remix/client';

export function TokenWatcher() {
	const { subscribeToEvent } = useStrivacity();

	useEffect(() => {
		const sub = subscribeToEvent('tokenRefreshed', ({ accessToken }) => {
			console.log('Token refreshed:', accessToken);
		});
		return () => sub.dispose();
	}, [subscribeToEvent]);

	return null;
}
```

---

## Back-channel logout

OIDC back-channel logout lets the authorization server terminate sessions server-to-server, without involving the browser. When the IDP sends a logout event (e.g. an admin terminates a session or the user logs out from a different device), it POSTs a signed `logout_token` JWT to the `/auth/backchannel-logout` endpoint registered automatically by `sdk.handler`.

The **default encrypted-cookie storage does not support back-channel logout** because each cookie is bound to a single browser session — there is no server-side index to look up by `sid` or `sub`. To support back-channel logout you need a custom server storage that implements `deleteByLogoutToken`:

```ts
// app/lib/auth/storage.ts
import type { RemixServerStorage } from '@strivacity/sdk-remix/server';

export const dbStorage: RemixServerStorage = {
	async get(key) {
		/* ... */
	},
	async set(key, value, ttl) {
		/* ... */
	},
	async delete(key) {
		/* ... */
	},

	/**
	 * Called when a verified back-channel logout token is received.
	 * The JWT is verified by the SDK before this is called; the decoded
	 * payload is passed as the argument.
	 * Delete all sessions matching the `sid` (session ID) or `sub` (user ID) claim.
	 */
	async deleteByLogoutToken(logoutToken) {
		await db.sessions.deleteWhere({
			sid: logoutToken.sid ?? undefined,
			sub: logoutToken.sub ?? undefined,
		});
	},
};
```

Pass the storage when creating the server SDK:

```ts
export const sdk = createServerSDK({
	// ...
	storage: dbStorage,
});
```

Configure the **Back-channel logout URI** in your Strivacity application settings to:

```
https://your-app.example.com/auth/backchannel-logout
```

Replace `/auth` with your `authUrlPrefix` value if you have customized it.

---

## Configuration reference

### Shared options (CSR and SSR)

| Option                   | Type                                                 | Required | Default           | Description                                                                                                                                                |
| ------------------------ | ------------------------------------------------------ | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`                   | `'redirect' \| 'popup' \| 'embedded' \| 'native'`    | Yes      | -                 | Login flow mode                                                                                                                                            |
| `issuer`                 | `string`                                             | Yes      | -                 | OIDC issuer URL of your Strivacity tenant                                                                                                                  |
| `clientId`               | `string`                                             | Yes      | -                 | OAuth2 public client ID                                                                                                                                    |
| `redirectUri`            | `string`                                             | Yes      | -                 | OAuth2 redirect URI (must match your app configuration)                                                                                                    |
| `scopes`                 | `string[]`                                           | No       | `['openid']`      | Requested OIDC scopes                                                                                                                                      |
| `responseType`           | `'code'`                                             | No       | `'code'`          | OAuth2 response type                                                                                                                                       |
| `responseMode`           | `'query' \| 'fragment'`                              | No       | `'query'`         | OAuth2 response mode                                                                                                                                       |
| `storageTokenName`       | `string`                                             | No       | `'sty.session'`   | Key under which the session is stored in the storage                                                                                                       |
| `serverSideSession`      | `boolean`                                            | No       | `false`\*         | Set to `true` when session storage is managed server-side (tokens are not written to client storage). \*Defaults to `true` when created via `createServerSDK` |
| `loginUri`               | `string`                                             | No       | `'/login'`        | URI of the app's login page; used in `embedded` and `native` modes when the SDK needs to redirect the user to login (e.g. on session expiry)               |
| `autoRefresh`            | `boolean`                                            | No       | `true`            | Automatically refreshes the access token before it expires. Set to `false` to manage refresh manually via `refresh()`                                      |
| `lazyLoad`               | `boolean`                                            | No       | `false`           | When `true`, defers initialization until the first method call and returns the instance synchronously                                                      |
| `logging`                | `SDKLogging`                                         | No       | -                 | Logging adapter                                                                                                                                            |
| `stateStorage`           | `SDKStorage`                                         | No       | same as `storage` | OAuth2 PKCE / state storage                                                                                                                                |
| `httpClient`             | `SDKHttpClient`                                      | No       | fetch             | Custom HTTP client adapter. Replace to add request interceptors or use an alternative fetch implementation                                                 |
| `getMetadata`            | `() => Promise<MetadataOptions>`                     | No       | -                 | Overrides the built-in OIDC discovery fetch. Called once and cached; useful for providing metadata from a BFF instead of fetching it directly from the IDP |
| `urlHandler`             | `(url, params?) => Promise<unknown>`                 | No       | -                 | Custom handler for URL redirects triggered by the SDK (e.g. to integrate with a router instead of `globalThis.location`)                                   |
| `callbackHandler`        | `(url, responseMode?) => Promise<unknown>`           | No       | -                 | Custom handler for processing the authorization server callback URL                                                                                        |
| `startSessionHandler`    | `(params: Record<string, unknown>) => Promise<void>` | No       | -                 | Overrides the built-in session start logic for `embedded` and `native` modes. Replaces the default `startSession` call entirely when provided              |
| `finalizeSessionHandler` | `(url: string \| URL) => Promise<void>`              | No       | -                 | Overrides the built-in session finalize logic for `embedded` and `native` modes. Replaces the default `finalizeSession` call entirely when provided        |

### Additional SSR-only options (`createServerSDK`)

| Option                  | Type                 | Required | Default          | Description                                                                                           |
| ----------------------- | --------------------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `storage`               | `RemixServerStorage` | No       | encrypted cookie | Custom session storage implementation                                                                 |
| `secret`                | `string`             | Yes\*    | -                | Secret used to encrypt the session cookie. \*Required when using the default encrypted cookie storage |
| `postLoginRedirectUri`  | `string`             | No       | origin           | Where to redirect after a successful login                                                            |
| `postLogoutRedirectUri` | `string`             | No       | origin           | Where to redirect after logout                                                                        |
| `authUrlPrefix`         | `string`             | No       | `'/auth'`        | URL prefix for auth handler routes                                                                    |
| `cookieMaxAge`          | `number`             | No       | `2592000`        | Session cookie max-age in seconds (default: 30 days)                                                  |

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
