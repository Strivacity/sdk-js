# @strivacity/sdk-next

Next.js SDK for [Strivacity](https://www.strivacity.com) - adds authentication, session management, and self-service account management to your Next.js application using OpenID Connect (OIDC).

> See the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/next) for a complete, working reference implementation covering both CSR and dynamic rendering setups.

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing an integration mode](#choosing-an-integration-mode)
- [Architecture: CSR and dynamic rendering](#architecture-csr-and-dynamic-rendering)
- [Session storages](#session-storages)
- [Quick start - CSR](#quick-start--csr)
- [Quick start - dynamic rendering](#quick-start--dynamic-rendering)
- [Login flows](#login-flows)
  - [redirect](#redirect-mode)
  - [popup](#popup-mode)
  - [embedded](#embedded-mode)
  - [native](#native-mode)
  - [Custom login session URI](#custom-login-session-uri)
- [Client API](#client-api)
- [Server API](#server-api)
- [Protecting pages and API routes](#protecting-pages-and-api-routes)
- [Session lifecycle](#session-lifecycle)
- [SDK events](#sdk-events)
- [Back-channel logout](#back-channel-logout)
- [Configuration reference](#configuration-reference)

---

## Prerequisites

- **Next.js 15 or later** (App Router is recommended; Pages Router is supported where noted)
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)
- Node.js 20+

---

## Installation

```bash
npm install @strivacity/sdk-next
```

---

## Choosing an integration mode

The SDK supports four login flow modes. Choose based on your UX and deployment requirements.

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where and how the login UI is rendered.

| Mode       | Login UI                                           | Default session storage                          | Best for                                   |
| ---------- | -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| `redirect` | Strivacity hosted page                             | Encrypted cookie (server)                        | Standard web apps                          |
| `popup`    | Strivacity hosted page in a popup                  | Encrypted cookie (server)                        | Apps that want to stay on the current page |
| `embedded` | Strivacity web components rendered inside your app | Encrypted cookie (server) or client localStorage | Branded login inside your own layout       |
| `native`   | Your own custom React components                   | Encrypted cookie (server) or client localStorage | Full UI control                            |

---

## Architecture: CSR and dynamic rendering

### CSR (Client-Side Rendering)

The SDK is initialized entirely in the browser. No server-side route handler is required. Multiple session storages are available out of the box — see [Session storages](#session-storages) for the full list and configuration examples. The default is `localStorage`.

Use `StyAuthProvider` from `@strivacity/sdk-next/client` to wrap your app.

**When to use:** Purely client-rendered apps (`export const dynamic = 'force-dynamic'`) or situations where you dont want to manage sessions on the server.

### Dynamic rendering (redirect / popup)

The SDK runs entirely on the server. By default sessions are stored using a **stateless, encrypted, HTTP-only cookie** — the client never sees raw tokens. `sdk.handler` handles the full OIDC flow (login, callback, logout, refresh, back-channel logout). Protect individual pages/routes with `sdk.withAuthGuard`/`sdk.withApiAuthRequired` - see [Protecting pages and API routes](#protecting-pages-and-api-routes).

Any custom storage can be passed via the `storage` option in `createServerSDK` — it just needs to implement the `NextServerStorage` interface. See [Session storages](#session-storages) for details and examples.

**When to use:** Apps using `redirect` or `popup` login mode where the login UI is hosted by Strivacity and no client-side auth state is needed beyond what Server Components can read.

### Dynamic rendering (embedded / native)

The `embedded` and `native` login modes render the login UI inside your own Next.js app, which means the login page is a client component. In these modes the server SDK still manages the session (same encrypted cookie as above), but you also need the client-side `StyAuthProvider` so that the login component can communicate with the SDK.

**embedded** - the login page renders Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). `sdk.handler` starts the login flow and handles the OAuth callback (token exchange and session cookie placement). See [embedded mode](#embedded-mode) for the full example.

**native** - the login page is built entirely with your own React components. Use the `useNativeLogin` hook, which drives the flow state (`loading`, `forms`, `messages`, `state`, `submitForm`, ...) and calls your `onLogin`/`onError`/`onFallback` callbacks as the flow progresses. See [native mode](#native-mode) for the full example.

In both cases, `StyAuthProvider` is mounted in the root layout. The server SDK still owns the session — the client provider is read-only context on top of it.

**When to use:** Apps where the login UI must live inside your own layout (`embedded`) or be built from scratch (`native`).

---

## Session storages

### Client-side (CSR)

Tokens and session data are stored entirely on the client side. The default storage is `localStorage`, but you can swap it out by passing any of the built-in factory functions — or any object implementing `SDKStorage` (`get`, `set`, `delete`) — as the `storage` option in `StyAuthProvider`.

All client storage exports come from `@strivacity/sdk-next/client`.

| Storage          | Export                        | Persists across                                  |
| ---------------- | ----------------------------- | ------------------------------------------------ |
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
import { createCookieStorage } from '@strivacity/sdk-next/client';

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
import { handleWorkerStorageRequests, createIndexedDBStorage } from '@strivacity/sdk-next/client';

handleWorkerStorageRequests(createIndexedDBStorage());
```

```ts
// app/lib/auth/options.ts
import { createWorkerStorage } from '@strivacity/sdk-next/client';

const worker = new Worker(new URL('./storage.worker.ts', import.meta.url), { type: 'module' });

export const sdkOptions = {
	// ...
	storage: createWorkerStorage(worker),
};
```

### Server-side (dynamic rendering)

By default the server SDK stores sessions in a **stateless, encrypted, HTTP-only cookie** (`getEncryptedCookieStorage`). The cookie is AES-encrypted using the `secret` you provide and automatically chunked when the payload is too large for a single cookie.

| Storage          | Export                                     | Notes                                      |
| ---------------- | ------------------------------------------ | ------------------------------------------ |
| Encrypted cookie | `getEncryptedCookieStorage(secret, opts?)` | Default; AES-encrypted, HTTP-only, chunked |

Any custom backend can be passed via the `storage` option in `createServerSDK`. It must implement the `NextServerStorage` interface (`get`, `set`, `delete`, `deleteByLogoutToken`).

#### Example: unstorage adapter

[unstorage](https://npmjs.com/package/unstorage) provides a unified async key-value API with dozens of built-in drivers (Redis, Cloudflare KV, filesystem, memory, and more). Wrap it to satisfy `NextServerStorage`:

```ts
// app/lib/auth/storage.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import type { NextServerStorage } from '@strivacity/sdk-next/server';

const storage = createStorage({
	driver: redisDriver({ url: process.env.REDIS_URL }),
});

export const sessionStorage: NextServerStorage = {
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
import { createServerSDK } from '@strivacity/sdk-next/server';
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
import type { SDKInitConfig } from '@strivacity/sdk-next/types';

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

Wrap the SDK options in a React component so the rest of the app can access auth state through context.

```tsx
// app/lib/auth/provider.tsx
'use client';

import type { ReactNode } from 'react';
import { StyAuthProvider, createDefaultLogging } from '@strivacity/sdk-next/client';
import { sdkOptions } from './options';

export function AuthProvider({ children }: { children: ReactNode }) {
	return <StyAuthProvider options={sdkOptions}>{children}</StyAuthProvider>;
}
```

### 3. Wrap your layout

Mount `AuthProvider` at the root so every page and component in the app can call `useStrivacity()`.

```tsx
// app/layout.tsx
import { AuthProvider } from './lib/auth/provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
```

### 4. Use the auth state

Call `useStrivacity()` in any client component to read the current authentication state and trigger login or logout. `loading` is `true` during the initial SDK setup - guard against rendering until it resolves.

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next/client';

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

## Quick start - dynamic rendering

### 1. Configure the SDK options

Same as in the CSR setup, with `serverSideSession: true` added to tell the SDK to store tokens on the server instead of in the browser.

```ts
// app/lib/auth/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-next/types';

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
import { createServerSDK } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: 'YOUR_SECRET', // used to encrypt the session cookie
});
```

### 3. Mount the route handler

A single catch-all route delegates all auth traffic to the SDK. It handles login initiation, the OAuth2 callback (code exchange), logout, silent refresh, and back-channel logout - no custom logic needed.

```ts
// app/auth/[...strivacity]/route.ts
import { sdk } from '../../lib/auth/server';

export const GET = sdk.handler;
export const POST = sdk.handler;
export const PUT = sdk.handler;
export const PATCH = sdk.handler;
export const DELETE = sdk.handler;
```

### 4. Protect pages and API routes

There is no global middleware - wrap individual Server Components with `sdk.withAuthGuard` and individual API routes with `sdk.withApiAuthRequired`. See [Protecting pages and API routes](#protecting-pages-and-api-routes) for the full reference.

```ts
// app/profile/page.tsx
import { sdk } from '../lib/auth/server';

export default sdk.withAuthGuard(async function ProfilePage({ session }) {
	return <p>Hello {session.claims?.given_name}</p>;
});
```

### 5. Create the client provider (optional)

Needed only if client components also need to read auth state (e.g. to show the user's name in a nav bar). The server session is passed as a prop so the client context is pre-populated on first render - no extra network request required.

```tsx
// app/lib/auth/provider.tsx
'use client';

import type { ReactNode } from 'react';
import type { SessionData } from '@strivacity/sdk-next/types';
import { StyAuthProvider } from '@strivacity/sdk-next/client';
import { sdkOptions } from './options';

export function AuthProvider({ session, children }: { session?: SessionData | null; children: ReactNode }) {
	return (
		<StyAuthProvider options={sdkOptions} session={session}>
			{children}
		</StyAuthProvider>
	);
}
```

Then pass the server session from the root layout:

```tsx
// app/layout.tsx
import { sdk } from './lib/auth/server';
import { AuthProvider } from './lib/auth/provider';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const session = await sdk.getSession();

	return (
		<html lang="en">
			<body>
				<AuthProvider session={session}>{children}</AuthProvider>
			</body>
		</html>
	);
}
```

---

## Login flows

### redirect mode

The user is redirected to the Strivacity-hosted login page and then back to your app after authentication. Works in both CSR and dynamic rendering setups.

In **CSR** mode, calling `login()` from `useStrivacity()` starts the redirect.

In **SSR** mode, navigating to `/auth/login` (the default route handled by `sdk.handler`) starts the redirect. You can trigger this with a plain `<a href="/auth/login">` or a server redirect.

### popup mode

The Strivacity login page opens in a popup window. After the user authenticates, the popup closes and the parent page receives the session.

Configuration is the same as redirect - just set `mode: 'popup'`. In CSR mode `login()` opens the popup automatically.

### embedded mode

The Strivacity login UI renders **inside your own page** using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). `sty-notifications` shows toast-style system notifications and `sty-language-selector` lets the user switch the login flow's language. The SDK streams the login flow state to these components without any full-page redirect.

There are no React wrapper components for them - mount the raw custom elements, load the components bundle with `injectScript`, and use a `ref` to set properties and subscribe to the `login`/`close`/`error` custom events (JSX only reliably sets primitive props like `sessionId`/`lang` as attributes; object props like `params` and custom events must be wired imperatively):

```tsx
// app/login/page.tsx
'use client';

import type { LoginComponent } from '@strivacity/sdk-next/client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { injectScript } from '@strivacity/sdk-next/client';

const issuer = process.env.ISSUER;

export default function LoginPage() {
	const router = useRouter();
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

		const onLogin = () => router.push('/profile');
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
	}, [router]);

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

In dynamic rendering mode the auth handler (`sdk.handler`) proxies the login flow from the IDP to the browser transparently. For a server-managed session, fetch `/auth/login/session` (handled by `sdk.handleLoginSession`) before mounting the component to obtain `session_id`/`short_app_id`/`language`, then set them on the `ref`'d element (`element.sessionId = ...`).

#### Externally-initiated flows (entry)

When a user clicks a link from an email (e.g. a password reset or invitation), the link contains a `challenge` that identifies an already-started IDP flow session. Point these links at `/auth/entry` - the handler resolves the challenge against the IDP, retrieves the active `session_id`, `short_app_id`, and `language` parameters, and redirects to the login page with those values as query parameters.

> Configure the destination in your Strivacity tenant to `https://your-app.example.com/auth/entry`. The login page URL is determined by the `loginUri` option (defaults to `/login`).

### native mode

You build the entire login UI with your own React components using the `useNativeLogin` hook. It drives the flow state and returns a `LoginContext`: `loading`, `forms` (current field values), `messages` (validation/info messages), `state` (the current `LoginFlowState` - `screen`, `forms` widget definitions, `layout`, `finalizeUrl`, ...), `submitForm`, `setFormValue`, `setMessage`, `triggerFallback`, `triggerClose`.

> The SDK does **not** ship ready-made widget components or a renderer for native mode - it only provides the state machine. Build your own widget components (or copy the ones from the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/next/components/login)) that read/write state via `useNativeLoginContext()`, and a `WidgetRenderer` that walks `state.layout.items` (each item is either `{ type: 'widget', formId, widgetId }`, resolved by looking it up in `state.forms`, or a nested `{ type: 'vertical' | 'horizontal', items: [...] }` group) to decide what to render and in what order.

#### Externally-initiated flows (entry)

Same as for embedded mode: point your Strivacity tenant's email link destination at `/auth/entry`. The handler resolves the challenge and redirects to the login page (`loginUri`) with `session_id`, `short_app_id`, and `language` as query parameters for `useNativeLogin` to resume the flow.

```tsx
// app/login/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useNativeLogin } from '@strivacity/sdk-next/client';
import { WidgetRenderer, widgets } from '../../components/login';

export default function LoginPage() {
	const router = useRouter();
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
			router.push('/profile');
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
			router.push(`/error?error=${encodeURIComponent(error.message)}`);
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

> In `native` mode the SDK calls `loginSessionUri` through `sdk.httpClient` (instead of navigating the browser) to resolve the session parameters - typically `/auth/login/session`, handled server-side by `sdk.handleLoginSession` in **dynamic rendering** setups.

`embedded` mode supports the same parameter directly on the `<sty-login>` element - set it via `params` on the `ref`'d element instead of letting it build the default IDP request:

```tsx
element.params = { loginSessionUri: '/auth/login/session' };
```

---

## Client API

All client exports come from `@strivacity/sdk-next/client`.

### `StyAuthProvider`

Context provider. Must wrap the part of your component tree that uses auth.

```tsx
<StyAuthProvider options={options} session={serverSession}>
	{children}
</StyAuthProvider>
```

| Prop       | Type                         | Description                                                                 |
| ---------- | ---------------------------- | --------------------------------------------------------------------------- |
| `options`  | `NextAuthProviderInitConfig` | SDK configuration (see [Configuration reference](#configuration-reference)) |
| `session`  | `SessionData \| null`        | Optional session pre-fetched on the server (dynamic rendering setup)        |
| `children` | `ReactNode`                  |                                                                             |

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
	 * In dynamic rendering mode, externally-initiated flows are handled server-side by the `/auth/entry` route instead.
	 */
	entry(url?: string | URL): Promise<void>;

	/**
	 * Exchanges the authorization code in the callback URL for tokens and persists the session.
	 * Only needed in client side rendering (CSR) `redirect` mode when the user is redirected back to your app after login. In dynamic rendering mode, the `/auth/callback` route handles this automatically.
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
'use client';

import { type RedirectFlow, useStrivacity } from '@strivacity/sdk-next/client';

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

All server exports come from `@strivacity/sdk-next/server`.

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

A universal Next.js route handler (App Router). Mount it as `GET`, `POST`, etc. on the `/auth/[...strivacity]` catch-all route. It handles:

- `/auth/login` - initiates the authorization code flow
- `/auth/login/session` - proxies an **embedded**-mode login session request to the IDP server-side; used as the default `loginSessionUri` target for server-managed sessions
- `/auth/register` - same as `/auth/login` with `prompt=create`
- `/auth/logout` - initiates end-session
- `/auth/callback` - exchanges the authorization code for tokens
- `/auth/refresh` - silently refreshes the session
- `/auth/revoke` - revokes the session tokens and redirects to the post-logout URI (without ending the IDP session)
- `/auth/entry` - handles externally-initiated flows (e.g. a password reset link from an email); processes the challenge, fetches the session parameters from the IDP, and redirects to the login page with `session_id`, `short_app_id`, and `language` as query params
- `/auth/backchannel-logout` - handles OIDC back-channel logout

You can customize the prefix with the `authUrlPrefix` config option.

### `sdk.getSession(req?)`

Returns the `SessionData` for the current request, or `null` if no valid session exists. Can be called in Server Components, `getServerSideProps`, or API routes.

```ts
// Server Component
const session = await sdk.getSession();

if (session?.access_token) {
	/* authenticated */
}

// API route (Pages Router)
const session = await sdk.getSession(req);
```

### `sdk.withAuthGuard(fn, opts?)`

Wraps an App Router page function. Redirects unauthenticated users to the login URL and injects the `session` into the page props when authenticated.

```ts
// app/dashboard/page.tsx
export default sdk.withAuthGuard(
  async function Dashboard({ session }) {
    return <p>Access token: {session.access_token}</p>;
  }
);
```

Also available as `sdk.withAuthGuard()` (no args) for the Pages Router - wraps a `getServerSideProps` function.

### `sdk.withApiAuthRequired(handler)`

Wraps an API route (App Router `AppRouteHandlerFn` or Pages Router `NextApiHandler`). Returns a `401` JSON response if no valid session is present.

```ts
// app/api/data/route.ts
import { sdk } from '../../lib/auth/server';
import { NextResponse } from 'next/server';

export const GET = sdk.withApiAuthRequired(async (req) => {
	return NextResponse.json({ secret: 'data' });
});
```

---

## Protecting pages and API routes

There is no global middleware - protect individual pages/routes explicitly:

### Via `withAuthGuard` (Server Component / page)

```ts
// app/profile/page.tsx
export default sdk.withAuthGuard(async function ProfilePage({ session }) {
  return <p>Hello {session.claims?.given_name}</p>;
});
```

### Via `withAuthGuard` (Client Component)

```tsx
// app/profile/page.tsx
export default withAuthGuard(function ProfilePage() {
	// only renders if authenticated
});
```

### Via `withApiAuthRequired` (API route)

```ts
export const GET = sdk.withApiAuthRequired(async (req) => {
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
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| `init`               | —                                       | SDK has finished initializing                                            |
| `sessionLoaded`      | `{ accessToken, refreshToken, claims }` | An existing session was read from storage on startup                     |
| `loginInitiated`     | —                                       | A login or registration redirect / popup has started                     |
| `loggedIn`           | `{ accessToken, refreshToken, claims }` | Tokens were received and stored after a successful login                 |
| `logoutInitiated`    | `{ idToken, claims }`                   | Logout was initiated, before redirecting to the IDP end-session endpoint |
| `tokenRefreshed`     | `{ accessToken, refreshToken, claims }` | Access token was silently refreshed                                      |
| `tokenRefreshFailed` | `{ refreshToken }`                      | A token refresh attempt failed (refresh token may be expired)            |
| `accessTokenExpired` | `{ accessToken, refreshToken }`         | The stored access token has passed its expiration time                   |
| `tokenRevoked`       | `{ token, tokenTypeHint }`              | A token was successfully revoked at the authorization server             |
| `tokenRevokeFailed`  | `{ token, tokenTypeHint }`              | A token revocation attempt failed                                        |

```tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';

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
import type { NextServerStorage } from '@strivacity/sdk-next/server';

export const dbStorage: NextServerStorage = {
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

| Option                   | Type                                                 | Required | Default           | Description                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                   | `'redirect' \| 'popup' \| 'embedded' \| 'native'`    | Yes      | -                 | Login flow mode                                                                                                                                               |
| `issuer`                 | `string`                                             | Yes      | -                 | OIDC issuer URL of your Strivacity tenant                                                                                                                     |
| `clientId`               | `string`                                             | Yes      | -                 | OAuth2 public client ID                                                                                                                                       |
| `redirectUri`            | `string`                                             | Yes      | -                 | OAuth2 redirect URI (must match your app configuration)                                                                                                       |
| `scopes`                 | `string[]`                                           | No       | `['openid']`      | Requested OIDC scopes                                                                                                                                         |
| `responseType`           | `'code'`                                             | No       | `'code'`          | OAuth2 response type                                                                                                                                          |
| `responseMode`           | `'query' \| 'fragment'`                              | No       | `'query'`         | OAuth2 response mode                                                                                                                                          |
| `storageTokenName`       | `string`                                             | No       | `'sty.session'`   | Key under which the session is stored in the storage                                                                                                          |
| `serverSideSession`      | `boolean`                                            | No       | `true`\*          | Set to `true` when session storage is managed server-side (tokens are not written to client storage). \*Defaults to `true` when created via `createServerSDK` |
| `loginUri`               | `string`                                             | No       | `'/login'`        | URI of the app's login page; used in `embedded` and `native` modes when the SDK needs to redirect the user to login (e.g. on session expiry)                  |
| `autoRefresh`            | `boolean`                                            | No       | `true`            | Automatically refreshes the access token before it expires. Set to `false` to manage refresh manually via `refresh()`                                         |
| `lazyLoad`               | `boolean`                                            | No       | `false`           | When `true`, defers initialization until the first method call and returns the instance synchronously                                                         |
| `logging`                | `SDKLogging`                                         | No       | -                 | Logging adapter                                                                                                                                               |
| `stateStorage`           | `SDKStorage`                                         | No       | same as `storage` | OAuth2 PKCE / state storage                                                                                                                                   |
| `httpClient`             | `SDKHttpClient`                                      | No       | fetch             | Custom HTTP client adapter. Replace to add request interceptors or use an alternative fetch implementation                                                    |
| `getMetadata`            | `() => Promise<MetadataOptions>`                     | No       | -                 | Overrides the built-in OIDC discovery fetch. Called once and cached; useful for providing metadata from a BFF instead of fetching it directly from the IDP    |
| `urlHandler`             | `(url, params?) => Promise<unknown>`                 | No       | -                 | Custom handler for URL redirects triggered by the SDK (e.g. to integrate with a router instead of `globalThis.location`)                                      |
| `callbackHandler`        | `(url, responseMode?) => Promise<unknown>`           | No       | -                 | Custom handler for processing the authorization server callback URL                                                                                           |
| `startSessionHandler`    | `(params: Record<string, unknown>) => Promise<void>` | No       | -                 | Overrides the built-in session start logic for `embedded` and `native` modes. Replaces the default `startSession` call entirely when provided                 |
| `finalizeSessionHandler` | `(url: string \| URL) => Promise<void>`              | No       | -                 | Overrides the built-in session finalize logic for `embedded` and `native` modes. Replaces the default `finalizeSession` call entirely when provided           |

### Additional SSR-only options (`createServerSDK`)

| Option                  | Type                | Required | Default          | Description                                                                                           |
| ----------------------- | ------------------- | -------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `storage`               | `NextServerStorage` | No       | encrypted cookie | Custom session storage implementation                                                                 |
| `secret`                | `string`            | Yes\*    | -                | Secret used to encrypt the session cookie. \*Required when using the default encrypted cookie storage |
| `postLoginRedirectUri`  | `string`            | No       | origin           | Where to redirect after a successful login                                                            |
| `postLogoutRedirectUri` | `string`            | No       | origin           | Where to redirect after logout                                                                        |
| `authUrlPrefix`         | `string`            | No       | `'/auth'`        | URL prefix for auth handler routes                                                                    |
| `cookieMaxAge`          | `number`            | No       | `2592000`        | Session cookie max-age in seconds (default: 30 days)                                                  |

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
