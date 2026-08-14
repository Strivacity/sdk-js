# @strivacity/sdk-svelte

Svelte SDK for [Strivacity](https://www.strivacity.com) - adds authentication, session management, and self-service account management to your Svelte or SvelteKit application using OpenID Connect (OIDC).

> See the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/sveltekit) for a complete, working reference implementation covering both CSR and SSR setups.

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

- **Svelte 5 or later**
- **SvelteKit 2 or later** - only required for the `/server` entry point; a plain Svelte + Vite app only needs `/client` and can skip it entirely
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)
- Node.js 20+ (when using the `/server` entry point)

---

## Installation

```bash
npm install @strivacity/sdk-svelte
```

> There is no top-level `@strivacity/sdk-svelte` entry point - always import from the `/client`, `/server`, `/types`, or `/errors` subpaths.

---

## Choosing an integration mode

The SDK supports four login flow modes. Choose based on your UX and deployment requirements.

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where and how the login UI is rendered.

| Mode       | Login UI                                           | Default session storage                          | Best for                                   |
| ---------- | --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| `redirect` | Strivacity hosted page                             | Encrypted cookie (server)                        | Standard web apps                          |
| `popup`    | Strivacity hosted page in a popup                  | Encrypted cookie (server)                        | Apps that want to stay on the current page |
| `embedded` | Strivacity web components rendered inside your app | Encrypted cookie (server) or client localStorage | Branded login inside your own layout       |
| `native`   | Your own custom Svelte components                  | Encrypted cookie (server) or client localStorage | Full UI control                            |

---

## Architecture: CSR and SSR

### CSR (Client-Side Rendering)

The SDK is initialized entirely in the browser. No server-side route is required, and this mode works in any Svelte 5 app - not just SvelteKit. Multiple session storages are available out of the box — see [Session storages](#session-storages) for the full list and configuration examples. The default is `localStorage`.

Use `createStyAuthProvider` from `@strivacity/sdk-svelte/client` in your root layout to make auth state available to the rest of the app.

**When to use:** Apps that render fully client-side, or situations where you don't want to manage sessions on the server.

### SSR (redirect / popup)

The SDK runs entirely on the server. By default sessions are stored using a **stateless, encrypted, HTTP-only cookie** — the client never sees raw tokens. `sdk.handle` is a SvelteKit `Handle` hook that handles the full OIDC flow (login, callback, logout, refresh, back-channel logout) and is mounted in `src/hooks.server.ts`. Protect individual routes with `sdk.requireSession` - see [Protecting routes](#protecting-routes).

Any custom storage can be passed via the `storage` option in `createServerSDK` — it just needs to implement the `SvelteKitServerStorage` interface. See [Session storages](#session-storages) for details and examples.

**When to use:** Apps using `redirect` or `popup` login mode where the login UI is hosted by Strivacity and no client-side auth state is needed beyond what `load()` functions can read.

### SSR (embedded / native)

The `embedded` and `native` login modes render the login UI inside your own SvelteKit app, which means the login route needs client-side interactivity. In these modes the server SDK still manages the session (same encrypted cookie as above), but you also need the client-side `createStyAuthProvider` so that the login component can communicate with the SDK.

**embedded** - the login route renders Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). `sdk.handle` starts the login flow and handles the OAuth callback (token exchange and session cookie placement). See [embedded mode](#embedded-mode) for the full example.

**native** - the login route is built entirely with your own Svelte components. Use the `useNativeLogin` hook, which drives the flow state (`loading`, `forms`, `messages`, `state`, `submitForm`, ...) and calls your `onLogin`/`onError`/`onFallback` callbacks as the flow progresses. See [native mode](#native-mode) for the full example.

In both cases, `createStyAuthProvider` is called in the root layout (`src/routes/+layout.svelte`). The server SDK still owns the session — the client provider is read-only context on top of it.

**When to use:** Apps where the login UI must live inside your own layout (`embedded`) or be built from scratch (`native`).

---

## Session storages

### Client-side (CSR)

Tokens and session data are stored entirely on the client side. The default storage is `localStorage`, but you can swap it out by passing any of the built-in factory functions — or any object implementing `SDKStorage` (`get`, `set`, `delete`) — as the `storage` option in `createStyAuthProvider`'s `options`.

All client storage exports come from `@strivacity/sdk-svelte/client`.

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
// src/lib/options.ts
import { createCookieStorage } from '@strivacity/sdk-svelte/client';

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
import { handleWorkerStorageRequests, createIndexedDBStorage } from '@strivacity/sdk-svelte/client';

handleWorkerStorageRequests(createIndexedDBStorage());
```

```ts
// src/lib/options.ts
import { createWorkerStorage } from '@strivacity/sdk-svelte/client';

const worker = new Worker(new URL('./storage.worker.ts', import.meta.url), { type: 'module' });

export const sdkOptions = {
	// ...
	storage: createWorkerStorage(worker),
};
```

### Server-side (SSR)

By default the server SDK stores sessions in a **stateless, encrypted, HTTP-only cookie** (`getEncryptedCookieStorage`), backed by SvelteKit's own `event.cookies` API. The cookie is AES-encrypted using the `secret` you provide and automatically chunked when the payload is too large for a single cookie.

| Storage          | Export                                     | Notes                                      |
| ---------------- | -------------------------------------------- | ------------------------------------------- |
| Encrypted cookie | `getEncryptedCookieStorage(secret, opts?)` | Default; AES-encrypted, HTTP-only, chunked |

Any custom backend can be passed via the `storage` option in `createServerSDK`. It must implement the `SvelteKitServerStorage` interface (`get`, `set`, `delete`, `deleteByLogoutToken`).

#### Example: unstorage adapter

[unstorage](https://npmjs.com/package/unstorage) provides a unified async key-value API with dozens of built-in drivers (Redis, Cloudflare KV, filesystem, memory, and more). Wrap it to satisfy `SvelteKitServerStorage`:

```ts
// src/lib/server/storage.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import type { SvelteKitServerStorage } from '@strivacity/sdk-svelte/server';

const storage = createStorage({
	driver: redisDriver({ url: process.env.REDIS_URL }),
});

export const sessionStorage: SvelteKitServerStorage = {
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
// src/lib/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-svelte/server';
import { sdkOptions } from '../options';
import { sessionStorage } from './storage';

export const sdk = createServerSDK({
	...sdkOptions,
	storage: sessionStorage,
});
```

---

## Quick start - CSR

### 1. Configure the SDK options

Define the core OIDC parameters your app will use. These values come from your Strivacity application configuration. The `mode` field controls which login flow the SDK uses.

```ts
// src/lib/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-svelte/types';

export const sdkOptions: SDKInitConfig = {
	mode: 'embedded', // 'redirect' | 'popup' | 'embedded' | 'native'
	issuer: 'https://YOUR_TENANT.strivacity.com', // OIDC issuer URL of your Strivacity tenant
	clientId: 'YOUR_CLIENT_ID', // OAuth2 public client ID
	redirectUri: 'https://YOUR_APP/callback', // OAuth2 redirect URI registered in your app config
	scopes: ['openid', 'profile', 'email'], // requested OIDC scopes
	// storageTokenName: 'sty.session', // custom storage key for the session
};
```

### 2. Create the provider

Call `createStyAuthProvider` at the top level of your root layout's `<script>` block so the rest of the app can access auth state through Svelte context. It must run during component initialization — Svelte's context APIs can't be called later (e.g. inside `onMount` or an event handler).

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import type { LayoutProps } from './$types';
	import { createStyAuthProvider, createDefaultLogging } from '@strivacity/sdk-svelte/client';
	import { sdkOptions } from '$lib/options';

	let { children }: LayoutProps = $props();

	createStyAuthProvider({ options: { ...sdkOptions, logging: createDefaultLogging() } });
</script>

{@render children()}
```

### 3. Use the auth state

Call `useStrivacity()` in any component to read the current authentication state and trigger login or logout. `ctx.loading` is `true` during the initial SDK setup - guard against rendering until it resolves.

```svelte
<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();
</script>

{#if ctx.loading}
	<!-- render nothing yet -->
{:else if ctx.isAuthenticated}
	<span>Hello, {ctx.idTokenClaims?.given_name}</span>
	<button onclick={() => ctx.logout()}>Log out</button>
{:else}
	<button onclick={() => ctx.login()}>Log in</button>
{/if}
```

---

## Quick start - SSR

### 1. Configure the SDK options

Same as in the CSR setup, with `serverSideSession: true` added to tell the SDK to store tokens on the server instead of in the browser.

```ts
// src/lib/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-svelte/types';

export const sdkOptions: SDKInitConfig = {
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native'
	issuer: 'https://YOUR_TENANT.strivacity.com', // OIDC issuer URL of your Strivacity tenant
	clientId: 'YOUR_CLIENT_ID', // OAuth2 public client ID
	redirectUri: 'https://YOUR_APP/callback', // OAuth2 redirect URI registered in your app config
	scopes: ['openid', 'profile', 'email'], // requested OIDC scopes
	serverSideSession: true, // store the session on the server (required for SSR)
	// storageTokenName: 'sty.session', // custom key name for the session cookie
	// postLoginRedirectUri: '/', // where to send the user after a successful login
	// postLogoutRedirectUri: '/', // where to send the user after logout
	// authUrlPrefix: '/auth', // URL prefix for the SDK's built-in route handler
};
```

### 2. Create the server SDK instance

Instantiates the server-side SDK. The `secret` is used to encrypt the session cookie, so raw tokens never leave the server. Keep the instance lazy so a build-time route-introspection pass without real environment variables doesn't crash.

```ts
// src/lib/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-svelte/server';
import { sdkOptions } from '../options';

let serverSdk: ReturnType<typeof createServerSDK> | undefined;

export function getServerSdk() {
	serverSdk ??= createServerSDK({
		...sdkOptions,
		secret: process.env.STRIVACITY_SECRET, // used to encrypt the session cookie
	});

	return serverSdk;
}
```

### 3. Mount the route handler

`sdk.handle` is a SvelteKit `Handle` hook that intercepts all auth traffic. Mount it in `src/hooks.server.ts` - it handles login initiation, the OAuth2 callback (code exchange), logout, silent refresh, and back-channel logout, and calls `resolve(event)` for every other request.

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { getServerSdk } from '$lib/server/strivacity';

export const handle: Handle = (input) => getServerSdk().handle(input);
```

### 4. Protect routes

There is no global middleware beyond `handle` itself - guard individual routes with `sdk.requireSession`, either from `hooks.server.ts` or from a page's own `load()` function. See [Protecting routes](#protecting-routes) for the full reference and an important caveat about where each approach works.

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { getServerSdk } from '$lib/server/strivacity';

export const handle: Handle = async (input) => {
	const { event } = input;
	const serverSdk = getServerSdk();

	if (event.url.pathname === '/profile') {
		await serverSdk.requireSession(event, { returnTo: '/profile' });
	}

	return serverSdk.handle(input);
};
```

### 5. Create the client provider (optional)

Needed only if client components also need to read auth state (e.g. to show the user's name in a nav bar). The server session is hydrated through `+layout.server.ts` so the client context is pre-populated on first render - no extra network request required.

```ts
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { getServerSdk } from '$lib/server/strivacity';

export const load: LayoutServerLoad = async (event) => {
	return {
		session: await getServerSdk().getSession(event),
	};
};
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import type { LayoutProps } from './$types';
	import { createStyAuthProvider } from '@strivacity/sdk-svelte/client';
	import { sdkOptions } from '$lib/options';

	let { data, children }: LayoutProps = $props();

	createStyAuthProvider({
		options: sdkOptions,
		session: () => data.session,
	});
</script>

{@render children()}
```

---

## Login flows

### redirect mode

The user is redirected to the Strivacity-hosted login page and then back to your app after authentication. Works in both CSR and SSR setups.

In **CSR** mode, calling `ctx.login()` from `useStrivacity()` starts the redirect.

In **SSR** mode, navigating to `/auth/login` (the default route handled by `sdk.handle`) starts the redirect. You can trigger this with a plain `<a href="/auth/login">` or a server redirect.

### popup mode

The Strivacity login page opens in a popup window. After the user authenticates, the popup closes and the parent page receives the session.

Configuration is the same as redirect - just set `mode: 'popup'`. In CSR mode `ctx.login()` opens the popup automatically.

### embedded mode

The Strivacity login UI renders **inside your own page** using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). `sty-notifications` shows toast-style system notifications and `sty-language-selector` lets the user switch the login flow's language. The SDK streams the login flow state to these components without any full-page redirect.

There are no Svelte wrapper components for them - mount the raw custom elements directly and load the components bundle with `injectScript`. Svelte assigns non-string props (like `params`) as DOM properties on custom elements automatically, and `onXxx` props are wired up as native event listeners - no manual ref/`addEventListener` plumbing needed, unlike other frameworks:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';

	const issuer = import.meta.env.VITE_ISSUER;

	// Load the web components bundle
	void import(/* @vite-ignore */ `${issuer}/assets/components/bundle.js`);
</script>

<section>
	<sty-notifications></sty-notifications>
	<sty-login
		onlogin={() => goto('/profile')}
		onclose={() => globalThis.location.reload()}
		onerror={(event: CustomEvent<string>) => alert(event.detail)}
	></sty-login>
	<sty-language-selector></sty-language-selector>
</section>
```

#### Controlling when the flow starts

By default the login flow starts automatically as soon as `sty-login` connects to the DOM. Add the `lazy` prop and bind the element to call `start()` when ready:

```svelte
<script lang="ts">
	import type { LoginComponent } from '@strivacity/sdk-svelte/client';

	let loginEl = $state<LoginComponent>();
</script>

<sty-login bind:this={loginEl} lazy></sty-login>
<button
	onclick={() =>
		loginEl?.start({
			loginHint: 'user@example.com', // pre-fill the identifier field
			acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
		})}
>
	Continue to login
</button>
```

In SSR mode the auth handler (`sdk.handle`) proxies the login flow from the IDP to the browser transparently. For a server-managed session, fetch `/auth/login/session` (handled by `sdk.handleLoginSession`) before mounting the component to obtain `session_id`/`short_app_id`/`language`, then pass them as props (`sessionId`/`shortAppId`/`lang`) on the element.

#### Externally-initiated flows (entry)

When a user clicks a link from an email (e.g. a password reset or invitation), the link contains a `challenge` that identifies an already-started IDP flow session. Point these links at `/auth/entry` - the handler resolves the challenge against the IDP, retrieves the active `session_id`, `short_app_id`, and `language` parameters, and redirects to the login page with those values as query parameters.

> Configure the destination in your Strivacity tenant to `https://your-app.example.com/auth/entry`. The login page URL is determined by the `loginUri` option (defaults to `/login`).

### native mode

You build the entire login UI with your own Svelte components using the `useNativeLogin` hook. It drives the flow state and returns a `LoginContext`: `loading`, `forms` (current field values), `messages` (validation/info messages), `state` (the current `LoginFlowState` - `screen`, `forms` widget definitions, `layout`, `finalizeUrl`, ...), `submitForm`, `setFormValue`, `setMessage`, `triggerFallback`, `triggerClose`.

> The SDK does **not** ship ready-made widget components or a renderer for native mode - it only provides the state machine. Build your own widget components that read/write state via `useNativeLoginContext()`, and a `WidgetRenderer` that walks `state.layout.items` (each item is either `{ type: 'widget', formId, widgetId }`, resolved by looking it up in `state.forms`, or a nested `{ type: 'vertical' | 'horizontal', items: [...] }` group) to decide what to render and in what order.

#### Externally-initiated flows (entry)

Same as for embedded mode: point your Strivacity tenant's email link destination at `/auth/entry`. The handler resolves the challenge and redirects to the login page (`loginUri`) with `session_id`, `short_app_id`, and `language` as query parameters for `useNativeLogin` to resume the flow.

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { useNativeLogin } from '@strivacity/sdk-svelte/client';
	import { WidgetRenderer, widgets } from '../../lib/components/login';

	const LayoutComponent = widgets.layout;

	const ctx = useNativeLogin({
		params: {
			// Optional parameters
			loginHint: 'user@example.com', // pre-fill the identifier field
			acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
			audiences: ['https://api.example.com'], // extra access token audiences
			sessionId: page.url.searchParams.get('session_id'),
			language: page.url.searchParams.get('language'),
		},
		onLogin: async () => {
			await goto('/profile');
		},
		onClose: () => {
			globalThis.location.reload();
		},
		// called when the native flow cannot continue (e.g. unsupported step) - fall back to the hosted login page
		onFallback: (error) => {
			globalThis.location.href = error.url.toString();
		},
		// called when the flow fails to initialize
		onError: async (error) => {
			await goto(`/error?error=${encodeURIComponent(error.message)}`);
		},
	});
</script>

{#if ctx.loading || !ctx.state.screen}
	<p>Loading...</p>
{:else}
	<section class="login-renderer">
		<LayoutComponent formId={ctx.state.layout?.items?.[0]?.formId} type={ctx.state.layout?.type} tag="form">
			<WidgetRenderer items={ctx.state.layout?.items} />
		</LayoutComponent>
	</section>
{/if}
```

### Custom login session URI

All four modes accept an optional `loginSessionUri` parameter to start the flow through your own server-side endpoint (e.g. a BFF) instead of the SDK's default IDP endpoint - useful when the request must be built/signed server-side. Sensitive OAuth2 parameters (`client_id`, `redirect_uri`, `scope`, PKCE, ...) are never sent to `loginSessionUri` - your endpoint is responsible for adding those itself; only the non-sensitive extras (`prompt`, `display`, `acrValues`, `loginHint`, `uiLocales`, `audiences`) are appended as query params.

In **CSR** mode, pass it to `ctx.login()`/`ctx.register()` (`redirect`/`popup`) or as part of `params` to `useNativeLogin()` (`native`):

```ts
// redirect / popup
await ctx.login({ loginSessionUri: '/api/auth/login' });

// native
useNativeLogin({ params: { loginSessionUri: '/auth/login/session' } });
```

> In `native` mode the SDK calls `loginSessionUri` through `sdk.httpClient` (instead of navigating the browser) to resolve the session parameters - typically `/auth/login/session`, handled server-side by `sdk.handleLoginSession` in **SSR** setups.

`embedded` mode supports the same parameter directly on the `<sty-login>` element - pass it via the `params` prop instead of letting it build the default IDP request:

```svelte
<sty-login params={{ loginSessionUri: '/auth/login/session' }}></sty-login>
```

---

## Client API

All client exports come from `@strivacity/sdk-svelte/client`.

### `createStyAuthProvider(props)`

Initializes the Strivacity SDK and sets up the Svelte context consumed by `useStrivacity()`. Must be called at the top level of a component's `<script>` block during component initialization (Svelte's context APIs don't work inside `onMount` or event handlers) - call it once in your root layout.

```ts
createStyAuthProvider({ options, session: () => serverSession });
```

| Property  | Type                                     | Description                                                                                    |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `options` | `SDKInitConfig`                          | SDK configuration (see [Configuration reference](#configuration-reference))                    |
| `session` | `() => SessionData \| null \| undefined` | Optional getter for the session pre-fetched on the server (SSR setup), read reactively on change |

### `useStrivacity<T>()`

The main hook. Returns the full auth context.

> Every field is a plain getter backed by a Svelte 5 rune under the hood - always read them off the object returned by `useStrivacity()` (e.g. `ctx.isAuthenticated`). Destructuring a primitive out of it (`const { isAuthenticated } = ctx`) captures a dead snapshot that will not update.

```ts
type SDKContext<Flow> = {
	/** true while the SDK is initializing */
	readonly loading: boolean;

	/** BCP 47 language code representing the current UI language */
	readonly language: string;

	/** true if the user has an active authenticated session */
	readonly isAuthenticated: boolean;

	/** decoded ID token claims, or null if not authenticated */
	readonly idTokenClaims: IdTokenClaims | null;

	/** raw access token string, or null if not authenticated */
	readonly accessToken: string | null;

	/** raw refresh token string, or null if not authenticated */
	readonly refreshToken: string | null;

	/** true if the access token is past its expiration time */
	readonly accessTokenExpired: boolean;

	/** Unix timestamp (seconds) when the access token expires, or null */
	readonly accessTokenExpirationDate: number | null;

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
	readonly sdk: Flow;
};
```

The generic parameter `T` can be `RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow` when you need type-safe access to flow-specific properties on `ctx.sdk`.

```svelte
<script lang="ts">
	import { type RedirectFlow, useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<RedirectFlow>();
</script>

{#if ctx.loading}
	<!-- render nothing yet -->
{:else if !ctx.isAuthenticated}
	<button onclick={() => ctx.login()}>Log in</button>
{:else}
	<div>
		<span>
			Hello, {ctx.idTokenClaims?.given_name} {ctx.idTokenClaims?.family_name}
		</span>
		<button onclick={() => ctx.logout()}>Log out</button>
	</div>
{/if}
```

### `useNativeLoginContext()`

Reads the `LoginContext` set by an ancestor `useNativeLogin()` call - throws if called outside of one. Used by your own widget components so the context doesn't need to be passed down as props.

---

## Server API

All server exports come from `@strivacity/sdk-svelte/server`.

### `createServerSDK(config)`

Creates and returns the server SDK instance. Call this once and export it from a shared module (e.g. `src/lib/server/strivacity.ts`). See [Configuration reference](#configuration-reference) for all available options.

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

### `sdk.handle`

A SvelteKit `Handle` hook. Mount it as (or combine it with `sequence()` into) the exported `handle` in `src/hooks.server.ts`. It handles:

- `/auth/login` - initiates the authorization code flow
- `/auth/login/session` - proxies an **embedded**-mode login session request to the IDP server-side; used as the default `loginSessionUri` target for server-managed sessions
- `/auth/register` - same as `/auth/login` with `prompt=create`
- `/auth/callback` - exchanges the authorization code for tokens
- `/auth/refresh` - silently refreshes the session
- `/auth/revoke` - revokes the session tokens and redirects to the post-logout URI (without ending the IDP session)
- `/auth/entry` - handles externally-initiated flows (e.g. a password reset link from an email); processes the challenge, fetches the session parameters from the IDP, and redirects to the login page with `session_id`, `short_app_id`, and `language` as query params
- `/auth/logout` - initiates end-session
- `/auth/backchannel-logout` - handles OIDC back-channel logout

Any request that doesn't match one of these routes is passed through to `resolve(event)` unchanged. You can customize the prefix with the `authUrlPrefix` config option.

### `sdk.getSession(event)`

Returns the `SessionData` for the current request, or `null` if no valid session exists. Can be called in `load()` functions or other server routes.

```ts
// src/routes/profile/+page.server.ts
import type { PageServerLoad } from './$types';
import { getServerSdk } from '$lib/server/strivacity';

export const load: PageServerLoad = async (event) => {
	const session = await getServerSdk().getSession(event);

	if (!session?.access_token) {
		/* not authenticated */
	}
};
```

### `sdk.requireSession(event, opts?)`

Guard for `+page.server.ts`/`+layout.server.ts` `load()` functions: returns the current `SessionData`, or throws SvelteKit's own `redirect()` to the login page if unauthenticated. Accepts an optional `{ returnTo }` to override the default (current pathname + search).

```ts
// src/routes/profile/+page.server.ts
import type { PageServerLoad } from './$types';
import { getServerSdk } from '$lib/server/strivacity';

export const load: PageServerLoad = async (event) => {
	const session = await getServerSdk().requireSession(event, { returnTo: '/profile' });
	return { givenName: session.claims?.given_name };
};
```

> This only works cleanly when the login target itself is a real page route - true for `embedded`/`native` modes, where `loginUri` (default `/login`) is one of your own `+page.svelte` routes. For `redirect`/`popup` modes the default login target is `/auth/login`, which only exists inside `hooks.server.ts`'s `handle` - a `redirect()` thrown from a page's `load()` to a non-page path fails. Guard those routes from `src/hooks.server.ts` instead - see [Protecting routes](#protecting-routes).

---

## Protecting routes

### Via `hooks.server.ts` (works for every mode, required for `redirect`/`popup`)

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { getServerSdk } from '$lib/server/strivacity';

export const handle: Handle = async (input) => {
	const { event } = input;
	const serverSdk = getServerSdk();

	if (event.url.pathname === '/profile') {
		await serverSdk.requireSession(event, { returnTo: '/profile' });
	}

	return serverSdk.handle(input);
};
```

### Via `requireSession` in a page's own `load()` (embedded/native modes, where `loginUri` is a real page)

```ts
// src/routes/profile/+page.server.ts
import type { PageServerLoad } from './$types';
import { getServerSdk } from '$lib/server/strivacity';

export const load: PageServerLoad = async (event) => {
	const session = await getServerSdk().requireSession(event, { returnTo: '/profile' });
	return { givenName: session.claims?.given_name };
};
```

### Client-side (CSR)

There is no built-in guard component - check `isAuthenticated` yourself and redirect once loading has settled:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (!ctx.loading && !ctx.isAuthenticated) {
			await goto('/login');
		}
	});
</script>

{#if ctx.isAuthenticated}
	<p>Hello {ctx.idTokenClaims?.given_name}</p>
{/if}
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

There is no automatic background refresh on the server - `getSession()` (and therefore `requireSession()`) only checks whether a session cookie exists, not whether its access token is still valid. Call `sdk.refreshSession(event)` (or hit the `/auth/refresh` route, handled by `sdk.handleRefresh`) explicitly when you need a fresh access token, e.g. before calling a downstream API. Set `cookieMaxAge` to control the outer session boundary; the individual access token lifetime is determined by the IDP.

If the refresh token has also expired, `refreshSession()`/`/auth/refresh` throws/responds accordingly and the user should be redirected to the login page.

### Post-login and post-logout redirect

By default the user is redirected to the application origin after login and logout. Override statically via config:

```ts
export const sdk = createServerSDK({
	postLoginRedirectUri: '/dashboard',
	postLogoutRedirectUri: '/',
});
```

To set the post-login destination dynamically, pass `?returnTo=<relative-path>` as a query parameter to the `/auth/login`, `/auth/register`, or `/auth/refresh` handler URLs - it's stored in a short-lived cookie and consumed by `/auth/callback` after a successful login. `postLogoutRedirectUri` has no per-request query override for `/auth/logout`; from a client component you can still pass it directly to `ctx.logout()` for CSR/embedded/native flows:

```svelte
<script lang="ts">
	const { logout } = useStrivacity();
</script>

<button onclick={() => logout({ postLogoutRedirectUri: '/bye' })}>Log out</button>
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

```svelte
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	const sub = ctx.subscribeToEvent('tokenRefreshed', ({ accessToken }) => {
		console.log('Token refreshed:', accessToken);
	});

	onDestroy(() => sub.dispose());
</script>
```

---

## Back-channel logout

OIDC back-channel logout lets the authorization server terminate sessions server-to-server, without involving the browser. When the IDP sends a logout event (e.g. an admin terminates a session or the user logs out from a different device), it POSTs a signed `logout_token` JWT to the `/auth/backchannel-logout` endpoint registered automatically by `sdk.handle`.

The **default encrypted-cookie storage does not support back-channel logout** because each cookie is bound to a single browser session — there is no server-side index to look up by `sid` or `sub`. To support back-channel logout you need a custom server storage that implements `deleteByLogoutToken`:

```ts
// src/lib/server/storage.ts
import type { SvelteKitServerStorage } from '@strivacity/sdk-svelte/server';

export const dbStorage: SvelteKitServerStorage = {
	async get(key) {
		/* ... */
	},
	async set(key, value) {
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

| Option                  | Type                     | Required | Default          | Description                                                                                           |
| ----------------------- | -------------------------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `storage`               | `SvelteKitServerStorage` | No       | encrypted cookie | Custom session storage implementation                                                                 |
| `secret`                | `string`                 | Yes\*    | -                | Secret used to encrypt the session cookie. \*Required when using the default encrypted cookie storage |
| `postLoginRedirectUri`  | `string`                 | No       | origin           | Where to redirect after a successful login                                                            |
| `postLogoutRedirectUri` | `string`                 | No       | origin           | Where to redirect after logout                                                                        |
| `authUrlPrefix`         | `string`                 | No       | `'/auth'`        | URL prefix for auth handler routes, matched by the `handle` hook                                      |
| `cookieMaxAge`          | `number`                 | No       | `2592000`        | Session cookie max-age in seconds (default: 30 days)                                                  |

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
