# @strivacity/sdk-svelte

Svelte SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Svelte/SvelteKit application. Ships with a client SDK and a backend-for-frontend ([BFF](../../README.md#bff)) Server SDK that runs entirely inside your SvelteKit app - no separate backend required.

Built on top of [@strivacity/sdk-core](../sdk-core) - see the [core SDK documentation](../sdk-core/README.md) for detailed information about authentication flows, configuration options, and advanced features.

**See also:**
- [Full Documentation](https://docs.strivacity.com/reference/overview) - Complete guide for all authentication modes
- [Example App](../../apps/sveltekit) - Working SvelteKit example covering both client-managed and server-managed sessions
- [Core SDK](../sdk-core/README.md) - Framework-agnostic SDK documentation

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Client-managed vs. server-managed sessions](#client-managed-vs-server-managed-sessions)
- [Quick start](#quick-start)
- [Client SDK](#client-sdk)
  - [Authentication modes](#authentication-modes)
    - [redirect mode](#redirect-mode)
    - [popup mode](#popup-mode)
    - [embedded mode](#embedded-mode)
    - [native mode](#native-mode)
  - [Hooks API](#hooks-api)
    - [useStrivacity](#usestrivacity)
    - [useNativeLogin](#usenativelogin)
- [Server SDK](#server-sdk)
  - [Setup](#setup)
  - [Accessing the session server-side](#accessing-the-session-server-side)
  - [Storages](#server-storages)
  - [Back-channel logout](#back-channel-logout)
  - [Server SDK API reference](#server-sdk-api-reference)
  - [Server configuration reference](#server-configuration-reference)
- [Route guards](#route-guards)
- [Shared features](#shared-features)
- [Configuration reference](#configuration-reference)
- [Migration guide](#migration-guide)
- [Vulnerability Reporting](#vulnerability-reporting)
- [License](#license)
- [Contributing](#contributing)

---

## Prerequisites

- Svelte 5+
- SvelteKit 2+ for server-managed sessions (optional peer dependency)
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-svelte
```

---

## Choosing a mode

The SDK supports **four authentication modes**:

| Mode       | Login UI                                 | Best for                                     |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `redirect` | Strivacity hosted page                   | Standard web apps                            |
| `popup`    | Strivacity hosted page in a popup        | SPAs that must stay on the current page      |
| `embedded` | Strivacity web components in your page   | Branded login inside your own layout         |
| `native`   | Your own components driven by flow state | Full UI control, step-by-step form rendering |

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where the login UI lives and how the flow state is consumed.

---

## Client-managed vs. server-managed sessions

The SDK supports two session strategies, selectable per app via a single option:

| Strategy | Tokens live in | Best for |
| -------- | --------------- | -------- |
| **Client-managed** | Browser storage (`localStorage` by default) | Simple SPAs that don't need to hide tokens from the browser |
| **Server-managed (BFF)** | Server-side storage (encrypted http-only cookies by default) via the [Server SDK](#server-sdk) | Apps that need to keep tokens inaccessible to client-side JavaScript, sign requests server-side, or add custom server-side validation |

Set `serverSessionUri` on the shared SDK options to switch the client SDK into server-managed mode - login requests are then routed through your own server endpoint instead of the SDK talking to the IDP directly, and tokens are never read from or written to client-side storage. See [Server-side session management](../sdk-core/README.md#server-side-session-management) in the core SDK docs for how this works under the hood. Both strategies are shown side by side below.

---

## Quick start

### 1. Configure shared options

Both the client and Server SDK read from the same configuration - keep it in one file and import it from both sides:

```ts
// src/lib/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-svelte/client';

export const sdkOptions: SDKInitConfig = {
	mode: 'redirect', // authentication mode
	issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
	clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
	redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
	scopes: ['openid', 'profile', 'email'], // requested user permissions/data

	// Omit this line entirely for client-managed sessions
	serverSessionUri: '/auth/login',
};
```

### 2. Set up the Server SDK

Only needed for server-managed sessions - skip this step (and step 3's hook) if you're using client-managed sessions.

```ts
// src/lib/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-svelte/server';
import { sdkOptions } from '../options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // http-only cookie encryption key (random 32+ characters)
	postLoginRedirectUri: '/profile',
});
```

### 3. Wire up the server hook

A single `handle` hook wires up every auth route automatically - it inspects the request path and either serves it directly or calls `resolve(event)` to fall through to the rest of your app:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { sdk } from './lib/server/strivacity';

export const handle: Handle = sdk.handle;
```

| Method | Path                        | Description                                              | Response                                    |
| ------ | --------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `GET`  | `/auth/login`                | Starts the login flow and redirects to the IDP              | `302` redirect to IDP                        |
| `GET`  | `/auth/register`             | Starts the registration flow and redirects to the IDP       | `302` redirect to IDP                        |
| `GET`  | `/auth/callback`             | Completes authentication (handles the IDP callback)          | `302` redirect or popup close script         |
| `GET`  | `/auth/refresh`              | Refreshes the access token                                   | `204 No Content` or `302` redirect           |
| `GET`  | `/auth/revoke`               | Revokes tokens and clears the session                        | `204 No Content`                             |
| `GET`  | `/auth/logout`               | Ends the session and redirects to the IDP logout page         | `302` redirect to IDP logout                 |
| `GET`  | `/auth/entry`                | Handles external flow entry (e.g., password reset link) - embedded/native modes only | JSON with session data |
| `POST` | `/auth/backchannel-logout`   | Processes back-channel logout requests from the IDP           | `204 No Content`                             |

> The `/auth` prefix and route names come from `authUrlPrefix` - see [Server configuration reference](#server-configuration-reference). Everything else falls through to `resolve(event)`, so `handle` is safe to compose with your own hooks via SvelteKit's [`sequence()`](https://svelte.dev/docs/kit/@sveltejs-kit-hooks#sequence).

### 4. Wrap your app with the client provider

`createStyAuthProvider` is a plain function, not a wrapping component - call it once at the top of your root layout's `<script>` (Svelte's context APIs only work during a component's own initialization, so this can't be done from `onMount` or an event handler):

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import type { LayoutProps } from './$types';
	import { createStyAuthProvider } from '@strivacity/sdk-svelte/client';
	import { sdkOptions } from '$lib/options';

	let { children }: LayoutProps = $props();

	createStyAuthProvider({ options: sdkOptions });
</script>

{@render children()}
```

For server-managed sessions, resolve the session once in a `+layout.server.ts` `load()` via the Server SDK's `getSession()`, and pass it to the provider as a getter so it stays reactive across navigations:

```ts
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { sdk } from '$lib/server/strivacity';

export const load: LayoutServerLoad = async (event) => {
	return {
		session: await sdk.getSession(event),
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

## Client SDK

### Authentication modes

The `mode` set in `src/lib/options.ts` (see [Quick start](#quick-start)) controls which of the four flows below is active - the `createStyAuthProvider` bootstrap shown in the [core SDK docs](../sdk-core/README.md#choosing-a-mode) is already handled by `src/routes/+layout.svelte`, so the examples below start directly from the page level.

#### redirect mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The current browser tab navigates to the Strivacity-hosted login page and back to the configured `redirectUri` after authentication.

##### Login

**Client-managed sessions**:

Call this to start the login flow. It redirects the user to the Strivacity login page in the current browser tab, where they authenticate.

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { RedirectFlow } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<RedirectFlow>();

	onMount(() => {
		void ctx.login({
			// Optional parameters
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
		});
	});
</script>

<section>
	<h1>Redirecting to login...</h1>
</section>
```


**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/login` - the `handle` hook from [Quick start](#quick-start) intercepts the request and the Server SDK builds the authorization request and redirects to the IDP:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		globalThis.location.href = '/auth/login';
	});
</script>
```

##### Handle the callback

**Client-managed sessions**:

Call this on your redirect URI page after the IDP sends the user back. It parses the query parameters from the callback URL, verifies the state matches what was stored during login (CSRF protection), exchanges the authorization code for tokens using PKCE, validates the ID token, and stores the session in the [configured storage](../sdk-core/README.md#storages).

```svelte
<!-- src/routes/callback/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (page.url.searchParams.has('error')) {
			await goto(`${resolve('/error')}?${page.url.searchParams}`, { replaceState: true });
			return;
		}

		try {
			await ctx.handleCallback();
			await goto(resolve('/profile'));
		} catch (error) {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	});
</script>

<section>
	<h1>Logging in...</h1>
</section>
```

**Server-managed sessions**:

Forward the callback query string to `/auth/callback` - the Server SDK completes the code exchange and redirects to `postLoginRedirectUri`:

```svelte
<!-- src/routes/callback/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		globalThis.location.href = `/auth/callback${globalThis.location.search}`;
	});
</script>

<section>
	<h1>Logging in...</h1>
</section>
```

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```svelte
<!-- src/routes/register/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { RedirectFlow } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<RedirectFlow>();

	onMount(() => {
		void ctx.register({
			loginHint: 'user@example.com',
		});
	});
</script>

<section>
	<h1>Redirecting to registration...</h1>
</section>
```

**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/register` - the Server SDK builds the registration request and redirects to the IDP:

```svelte
<!-- src/routes/register/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		globalThis.location.href = '/auth/register';
	});
</script>
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (ctx.isAuthenticated) {
			await ctx.logout();
		}
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		globalThis.location.href = '/auth/logout';
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```svelte
<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await ctx.refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await ctx.revoke();
	}
</script>

<!-- idTokenClaims/accessToken/refreshToken are plain getters on ctx - reading them here keeps this reactive -->
{#if !ctx.loading}
	<div>
		<button onclick={onRefresh}>Refresh</button>
		<button onclick={onRevoke}>Revoke</button>
		<pre>{JSON.stringify({ idTokenClaims: ctx.idTokenClaims, accessToken: ctx.accessToken, refreshToken: ctx.refreshToken }, null, 2)}</pre>
	</div>
{/if}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the hook redirect back:

```svelte
<script lang="ts">
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		globalThis.location.href = '/auth/revoke';
	}
</script>

<div>
	<button onclick={onRefresh}>Refresh</button>
	<button onclick={onRevoke}>Revoke</button>
</div>
```

---

#### popup mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The Strivacity login page opens in a separate window or tab. After authentication the opened window or tab closes itself and the parent page receives the session - no full-page navigation required.

##### Login

**Client-managed sessions**:

Call this to start the login flow. It opens a popup window by default with the Strivacity login page, where the user authenticates. After that the popup closes itself and the session is stored in the [configured storage](../sdk-core/README.md#storages).

By default a centered popup window opens. Pass `popupWindowTarget` to change where the window opens, and `popupWindowFeatures` to control its size and position:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { PopupFlow } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<PopupFlow>();

	onMount(async () => {
		try {
			await ctx.login({
				// Optional parameters
				loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
				acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
				audiences: ['https://api.example.com'], // target resources for the access token
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
			await goto(resolve('/profile'));
		} catch (error) {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	});
</script>

<section>
	<h1>Opening login popup...</h1>
</section>
```

**Server-managed sessions**:

Popup mode always needs client-side JavaScript to open the window, so there's no server-only alternative here.

##### Handle the callback

**Client-managed sessions**:

The popup resolves automatically - no callback page is needed. Token exchange happens inside the popup and the result is posted back to the opener window.

**Server-managed sessions**:

Same as client managed - the popup's internal callback request is also transparently proxied through `/auth/callback`, and the result is posted back to the opener window exactly the same way.

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```svelte
<!-- src/routes/register/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { PopupFlow } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<PopupFlow>();

	onMount(async () => {
		try {
			await ctx.register({
				// Optional parameters
				loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
				acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
				audiences: ['https://api.example.com'], // target resources for the access token
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
			await goto(resolve('/profile'));
		} catch (error) {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	});
</script>

<section>
	<h1>Opening registration popup...</h1>
</section>
```

**Server-managed sessions**:

Popup mode always needs client-side JavaScript to open the window, so there's no server-only alternative here.

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (ctx.isAuthenticated) {
			await ctx.logout();
		}
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		globalThis.location.href = '/auth/logout';
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```svelte
<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await ctx.refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await ctx.revoke();
	}
</script>

{#if !ctx.loading}
	<div>
		<button onclick={onRefresh}>Refresh</button>
		<button onclick={onRevoke}>Revoke</button>
		<pre>{JSON.stringify({ idTokenClaims: ctx.idTokenClaims, accessToken: ctx.accessToken, refreshToken: ctx.refreshToken }, null, 2)}</pre>
	</div>
{/if}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the hook redirect back:

```svelte
<script lang="ts">
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		globalThis.location.href = '/auth/revoke';
	}
</script>

<div>
	<button onclick={onRefresh}>Refresh</button>
	<button onclick={onRevoke}>Revoke</button>
</div>
```

---

#### embedded mode

> For details on how this mode works, see the [embedded journey documentation](https://docs.strivacity.com/reference/embedded-journey).

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your Strivacity tenant cluster once, on the login page. Svelte assigns non-string props (like `params`) as DOM properties automatically and wires `onxxx` props up as native event listeners, so there's no ref/`useEffect`-style wiring needed for the basic case:

##### Login / Register

**Client-managed sessions**:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useStrivacity, injectScript } from '@strivacity/sdk-svelte/client';

	const { sdk } = useStrivacity();

	// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
	// custom element definitions from the auth server
	injectScript('sty-components', `${sdk.options.issuer}/assets/components/bundle.js`);

	// Optional: Resume a session started from an entry URL (e.g., password reset)
	const sessionId = page.url.searchParams.get('session_id');
	const shortAppId = page.url.searchParams.get('short_app_id');
	const language = page.url.searchParams.get('language') ?? globalThis.navigator?.language;

	const params = {
		loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
		acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
		audiences: ['https://api.example.com'], // target resources for the access token
		language: 'en-US', // set the UI language (BCP 47 language tag)
		prompt: 'login', // use 'create' to open the registration flow instead
	};
</script>

<section>
	<sty-notifications></sty-notifications>
	<sty-login
		{params}
		{sessionId}
		{shortAppId}
		lang={language}
		onlogin={() => goto(resolve('/profile'))}
		onclose={() => globalThis.location.reload()}
		onerror={(event: CustomEvent<string>) => goto(`${resolve('/error')}?message=${encodeURIComponent(event.detail)}`)}
	></sty-login>
	<sty-language-selector></sty-language-selector>
</section>
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - the `<sty-login>` component's internal requests are transparently proxied through `/auth/login`/`/auth/register` instead of going straight to the IDP.

##### Controlling when the flow starts

By default the login flow starts automatically as soon as `<sty-login>` connects to the DOM. Add the `lazy` attribute to take manual control, then call `start()` when ready. `start()` accepts an optional params object forwarded to the authorization request, or you can set params via the `params` property before calling it:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { LoginComponent } from '@strivacity/sdk-svelte/client/types';

	let loginRef: LoginComponent;

	async function onStartClick() {
		await loginRef.start({
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			language: 'en-US', // set the UI language (BCP 47 language tag)
			prompt: 'login', // use 'create' to open the registration flow instead
		});
	}
</script>

<section>
	<sty-notifications></sty-notifications>
	<button onclick={onStartClick}>Continue to login</button>
	<sty-login bind:this={loginRef} lazy onlogin={() => goto(resolve('/profile'))}></sty-login>
	<sty-language-selector></sty-language-selector>
</section>
```

You can also set params via the `params` property before calling `start()`:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import type { LoginComponent } from '@strivacity/sdk-svelte/client/types';

	let loginRef: LoginComponent;

	async function onStartClick() {
		loginRef.params = {
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			language: 'en-US', // set the UI language (BCP 47 language tag)
			prompt: 'login', // use 'create' to open the registration flow instead
		};
		await loginRef.start();
	}
</script>

<sty-login bind:this={loginRef} lazy></sty-login>
<button onclick={onStartClick}>Start Login</button>
```

##### Login events

The `<sty-login>` element dispatches `login`, `close`, and `error` custom events - bind them the same way as `onlogin`/`onclose`/`onerror` props shown above. If you need to attach/detach listeners manually instead (e.g. conditionally), grab the element via `bind:this` and use `addEventListener` in an `$effect`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { LoginComponent } from '@strivacity/sdk-svelte/client/types';

	let loginRef: LoginComponent;

	$effect(() => {
		const element = loginRef;

		if (!element) {
			return;
		}

		const onLogin = () => {
			// User authenticated - navigate to a protected page
			void goto(resolve('/profile'));
		};
		const onClose = () => {
			// User cancelled or closed the login flow
			globalThis.location.reload();
		};
		const onError = (event: Event) => {
			// A fatal error occurred - the message is available in event.detail
			void goto(`${resolve('/error')}?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);
		};

		element.addEventListener('login', onLogin);
		element.addEventListener('close', onClose);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('close', onClose);
			element.removeEventListener('error', onError);
		};
	});
</script>

<section>
	<sty-notifications></sty-notifications>
	<sty-login bind:this={loginRef}></sty-login>
	<sty-language-selector></sty-language-selector>
</section>
```

##### Notification events

The components dispatch `notification` events on the `document` that the `<sty-notifications>` component automatically displays. If you don't want to use `<sty-notifications>`, you can listen to these events and handle them yourself:

```svelte
<script lang="ts">
	$effect(() => {
		function onNotification(event: Event) {
			const customEvent = event as CustomEvent;

			if (customEvent.detail.action === 'show') {
				// Add new notification to your custom notification system
				console.log('New notification:', customEvent.detail.notification);
			} else if (customEvent.detail.action === 'clear') {
				console.log('Clear all notifications');
			}
		}

		document.addEventListener('notification', onNotification);

		return () => document.removeEventListener('notification', onNotification);
	});
</script>
```

##### Dynamic language switching

The `<sty-language-selector>` component provides a built-in UI for language switching. If you don't want to use it, you can change the UI language dynamically by updating the `lang` property on the `<sty-login>` component:

```svelte
<script lang="ts">
	let currentLang = $state('en-US');
</script>

<section>
	<div>
		<button onclick={() => (currentLang = 'en-US')}>English</button>
		<button onclick={() => (currentLang = 'fr-FR')}>Français</button>
		<button onclick={() => (currentLang = 'de-DE')}>Deutsch</button>
	</div>
	<sty-login lang={currentLang}></sty-login>
</section>
```

##### Handle the callback

**Client-managed sessions**:

No separate callback page is needed. The `<sty-login>` component handles the entire authentication flow automatically, including token exchange, and dispatches a `login` event when authentication completes successfully.

**Server-managed sessions**:

Same as client managed - the component's internal callback request is also transparently proxied through `/auth/callback`, with no separate route needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing route to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login route**

Forward the parameters as query params to your login route:

```svelte
<!-- src/routes/entry/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { EmbeddedFlow } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<EmbeddedFlow>();

	onMount(async () => {
		try {
			const data = await ctx.entry();
			// Redirect to login route with flow parameters
			const params = new URLSearchParams({
				session_id: data.session_id,
				short_app_id: data.short_app_id,
				language: data.language,
			});
			globalThis.location.href = `/login?${params}`;
		} catch (error) {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	});
</script>

<section>
	<h1>Loading...</h1>
</section>
```

Then on your login route, read the parameters and pass them to `<sty-login>`:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// Read parameters from URL
	const sessionId = page.url.searchParams.get('session_id');
	const shortAppId = page.url.searchParams.get('short_app_id');
	const language = page.url.searchParams.get('language');
</script>

<section>
	<sty-notifications></sty-notifications>
	<sty-login
		{sessionId}
		{shortAppId}
		lang={language}
		onlogin={() => goto(resolve('/profile'))}
		onerror={(event: CustomEvent<string>) => goto(`${resolve('/error')}?message=${encodeURIComponent(event.detail)}`)}
	></sty-login>
	<sty-language-selector></sty-language-selector>
</section>
```

**Option 2: Render login on the entry route**

Pass the parameters directly to `<sty-login>` on the same route:

```svelte
<!-- src/routes/entry/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { EmbeddedFlow } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<EmbeddedFlow>();

	let sessionId = $state<string | null>(null);
	let shortAppId = $state<string | null>(null);
	let language = $state<string | null>(null);

	onMount(async () => {
		try {
			const data = await ctx.entry();
			// Set state for sty-login component
			sessionId = data.session_id;
			shortAppId = data.short_app_id;
			language = data.language;
		} catch (error) {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	});
</script>

{#if !sessionId}
	<section>
		<h1>Loading...</h1>
	</section>
{:else}
	<section>
		<sty-notifications></sty-notifications>
		<sty-login
			{sessionId}
			{shortAppId}
			lang={language}
			onlogin={() => goto(resolve('/profile'))}
			onerror={(event: CustomEvent<string>) => goto(`${resolve('/error')}?message=${encodeURIComponent(event.detail)}`)}
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
{/if}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (ctx.isAuthenticated) {
			await ctx.logout();
		}
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		globalThis.location.href = '/auth/logout';
	});
</script>
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```svelte
<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await ctx.refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await ctx.revoke();
	}
</script>

{#if !ctx.loading}
	<div>
		<button onclick={onRefresh}>Refresh</button>
		<button onclick={onRevoke}>Revoke</button>
		<pre>{JSON.stringify({ idTokenClaims: ctx.idTokenClaims, accessToken: ctx.accessToken, refreshToken: ctx.refreshToken }, null, 2)}</pre>
	</div>
{/if}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the hook redirect back:

```svelte
<script lang="ts">
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		globalThis.location.href = '/auth/revoke';
	}
</script>

<div>
	<button onclick={onRefresh}>Refresh</button>
	<button onclick={onRevoke}>Revoke</button>
</div>
```

---

#### native mode

> For details on how this mode works, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey).

You build the entire login UI with your own components. `useNativeLogin()` drives a "headless" auth flow: instead of redirecting to a hosted page, the SDK returns a JSON description of the current screen that you render yourself, submit each form step with `submitForm()`, and repeat until the flow finalizes automatically.

> The example below shows a simplified custom implementation. For a complete native renderer with all widget types, see the [example app](../../apps/sveltekit/src/lib/components/auth/native/NativeLogin.svelte).

##### Login / Register

**Client-managed sessions**:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useNativeLogin } from '@strivacity/sdk-svelte/client';

	const ctx = useNativeLogin({
		params: {
			prompt: 'login', // use 'create' to open the registration flow instead
			language: 'en-US', // set the UI language (BCP 47 language tag)
			sdk: 'web-minimal', // rendering mode: 'web-minimal' for simplified rendering, 'web' (default) for full rendering hints and branding
			sessionId: page.url.searchParams.get('session_id'), // pass a session ID to resume an existing flow
		},
		onLogin: async () => {
			await goto(resolve('/profile'));
		},
		onClose: () => {
			globalThis.location.reload();
		},
		onError: async (error) => {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error.message)}`);
		},
		onFallback: (error) => {
			// Fallback to hosted journey if native widget not supported
			globalThis.location.href = error.url.toString();
		},
		onGlobalMessage: (message) => {
			alert(message.text);
		},
	});
</script>

{#if ctx.loading || !ctx.state.screen}
	<section>
		<h1>Loading...</h1>
	</section>
{:else if ctx.state.screen === 'identifier'}
	<section>
		<h2>Sign In</h2>
		<form
			onsubmit={async (event) => {
				event.preventDefault();
				await ctx.submitForm('identifier');
			}}
		>
			<input
				type="text"
				placeholder="Email"
				value={(ctx.forms['identifier']?.identifier as string) ?? ''}
				oninput={(event) => ctx.setFormValue('identifier', 'identifier', event.currentTarget.value)}
			/>
			{#if ctx.messages['identifier']?.identifier}
				<div class="error">{ctx.messages['identifier'].identifier.text}</div>
			{/if}
			<button type="submit">Continue</button>
		</form>
	</section>
{:else if ctx.state.screen === 'password'}
	<section>
		<h2>Enter Password</h2>
		<form
			onsubmit={async (event) => {
				event.preventDefault();
				await ctx.submitForm('password');
			}}
		>
			<input
				type="password"
				placeholder="Password"
				value={(ctx.forms['password']?.password as string) ?? ''}
				oninput={(event) => ctx.setFormValue('password', 'password', event.currentTarget.value)}
			/>
			{#if ctx.messages['password']?.password}
				<div class="error">{ctx.messages['password'].password.text}</div>
			{/if}
			<button type="submit">Sign In</button>
		</form>
	</section>
{/if}
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - `useNativeLogin`'s internal requests are transparently proxied through your server instead of going straight to the IDP.

##### Handle the callback

**Client-managed sessions**:

No separate callback route is needed. Once `ctx.state.finalizeUrl` is set, `submitForm()` automatically finalizes the session internally to exchange the authorization code for tokens and store it.

**Server-managed sessions**:

Same as client managed - finalizing the session also transparently proxies through your server, with no separate route needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing route to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login route**

```svelte
<!-- src/routes/entry/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { NativeFlow } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity<NativeFlow>();

	onMount(async () => {
		try {
			const data = await ctx.entry();
			const params = new URLSearchParams({
				session_id: data.session_id,
				short_app_id: data.short_app_id,
				language: data.language,
			});
			globalThis.location.href = `/login?${params}`;
		} catch (error) {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	});
</script>

<section>
	<h1>Loading...</h1>
</section>
```

Then on your login route, read query parameters from the URL and pass it to `useNativeLogin` to resume the flow, exactly as shown in the Login / Register example above:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { useNativeLogin } from '@strivacity/sdk-svelte/client';

	const ctx = useNativeLogin({
		params: {
			sessionId: page.url.searchParams.get('session_id'),
			language: page.url.searchParams.get('language'),
		},
		onLogin: async () => {
			globalThis.location.href = '/profile';
		},
	});

	// ...render based on `ctx.state.screen` as shown in the Login / Register example above
</script>
```

**Option 2: Render login on the entry route**

Call `useNativeLogin` directly inside `src/routes/entry/+page.svelte`, feeding it the `session_id` resolved from `entry()` - no redirect needed:

```svelte
<!-- src/routes/entry/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity, useNativeLogin } from '@strivacity/sdk-svelte/client';
	import type { NativeFlow } from '@strivacity/sdk-svelte/client';

	const sdkCtx = useStrivacity<NativeFlow>();

	let sessionId = $state<string | null>(null);
	let language = $state<string | null>(null);
	let ready = $state(false);

	onMount(async () => {
		try {
			const data = await sdkCtx.entry();
			sessionId = data.session_id;
			language = data.language;
			ready = true;
		} catch (error) {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	});

	const ctx = useNativeLogin({
		params: { sessionId, language },
		onLogin: async () => {
			await goto(resolve('/profile'));
		},
		onError: async (error) => {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error.message)}`);
		},
	});
</script>

{#if !ready || ctx.loading || !ctx.state.screen}
	<section>
		<h1>Loading...</h1>
	</section>
{:else}
	<!-- ...render based on `ctx.state.screen` as shown in the Login / Register example above -->
{/if}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (ctx.isAuthenticated) {
			await ctx.logout();
		}
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```svelte
<!-- src/routes/logout/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		globalThis.location.href = '/auth/logout';
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```svelte
<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await ctx.refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await ctx.revoke();
	}
</script>

{#if !ctx.loading}
	<div>
		<button onclick={onRefresh}>Refresh</button>
		<button onclick={onRevoke}>Revoke</button>
		<pre>{JSON.stringify({ idTokenClaims: ctx.idTokenClaims, accessToken: ctx.accessToken, refreshToken: ctx.refreshToken }, null, 2)}</pre>
	</div>
{/if}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the hook redirect back:

```svelte
<script lang="ts">
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		globalThis.location.href = '/auth/revoke';
	}
</script>

<div>
	<button onclick={onRefresh}>Refresh</button>
	<button onclick={onRevoke}>Revoke</button>
</div>
```

---

### Hooks API

#### useStrivacity

The main function for accessing the SDK instance and reactive session state.

```ts
import { useStrivacity } from '@strivacity/sdk-svelte/client';
import type { RedirectFlow } from '@strivacity/sdk-svelte/client';

const ctx = useStrivacity<RedirectFlow>();
```

##### Returns

```ts
{
	// SDK instance (access any SDK method)
	readonly sdk: RedirectFlow | PopupFlow | EmbeddedFlow | NativeFlow;

	// Reactive state (plain getters - read them directly wherever needed, don't destructure)
	readonly loading: boolean; // True during initialization
	readonly language: string; // Current BCP 47 language code
	readonly isAuthenticated: boolean; // True if user has valid session
	readonly idTokenClaims: IdTokenClaims | null; // Decoded ID token claims
	readonly accessToken: string | null; // Current access token
	readonly refreshToken: string | null; // Current refresh token
	readonly accessTokenExpired: boolean; // True once the access token has expired
	readonly accessTokenExpirationDate: number | null; // Access token expiration timestamp

	// Methods (all are async)
	login(params?: LoginParams): Promise<void>; // Start login flow
	register(params?: LoginParams): Promise<void>; // Start registration flow
	handleCallback(url?: string): Promise<void>; // Handle OAuth callback
	logout(params?: LogoutParams): Promise<void>; // End session
	refresh(): Promise<void>; // Refresh access token
	revoke(): Promise<void>; // Revoke tokens
	entry(): Promise<EntryData>; // Handle external entry (embedded/native only)
}
```

#### useNativeLogin

Function for managing native login flow state. Only available in `native` mode.

```ts
import { useNativeLogin } from '@strivacity/sdk-svelte/client';
import type { NativeParams } from '@strivacity/sdk-svelte/client';

const ctx = useNativeLogin({
	params: { /* login params */ },
	onLogin: (session) => { /* handle login */ },
	onError: (error) => { /* handle error */ },
	// ... other callbacks
});
```

##### Options

```ts
{
	params?: NativeParams; // Initial flow parameters
	onLogin?: (session: SessionData) => void | Promise<void>; // Called on successful login
	onClose?: () => void; // Called when user closes the flow
	onError?: (error: unknown) => void; // Called on error
	onFallback?: (error: FallbackError) => void; // Called when fallback needed
	onGlobalMessage?: (message: NativeFlowMessage) => void; // Called for global messages
}
```

##### Returns

```ts
{
	// Reactive state (plain getters - read them directly wherever needed, don't destructure)
	loading: boolean; // True while fetching next screen
	state: Partial<NativeFlowState>; // Current flow state (screen, forms, layout, etc.)
	forms: Record<string, Record<string, unknown>>; // Form data by form ID
	messages: Record<string, Record<string, NativeFlowMessage>>; // Validation messages

	// Methods
	submitForm(formId: string, customBody?: Record<string, unknown>): Promise<void>; // Submit a form and advance to next screen
	setFormValue(formId: string, widgetId: string, value: unknown): void; // Update a single field value before submission
	setMessage(formId: string, widgetId: string, value: NativeFlowMessage): void; // Set a validation/info message on a widget
	triggerFallback(message?: string): void; // Manually trigger fallback to hosted journey
	triggerClose(): void; // Signal that the login flow was closed by the user
}
```

---

## Server SDK

This is the same backend-for-frontend ([BFF](../../README.md#bff)) server implementation as the [core Server SDK](../sdk-core/README.md#server-sdk), pre-wired for SvelteKit: `createServerSDK` provides a SvelteKit `ServerAdapter` and a default encrypted-cookie storage built on `event.cookies`.

### Setup

```ts
// src/lib/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-svelte/server';
import { sdkOptions } from '../options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // required unless you provide a custom `storage`
	postLoginRedirectUri: '/profile',
});
```

Mount the `handle` hook once - see [Quick start](#quick-start) for the full `hooks.server.ts` wiring. It's a plain `Handle`, so it composes with your own hooks via SvelteKit's [`sequence()`](https://svelte.dev/docs/kit/@sveltejs-kit-hooks#sequence):

```ts
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { sdk } from '$lib/server/strivacity';
import { myOwnHook } from './my-own-hook';

export const handle = sequence(sdk.handle, myOwnHook);
```

### Accessing the session server-side

Call `getSession(event)` from any `load()` function, form action, or `+server.ts` handler to read the current session without going through the client SDK:

```ts
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { sdk } from '$lib/server/strivacity';

export const load: LayoutServerLoad = async (event) => {
	return {
		session: await sdk.getSession(event),
	};
};
```

Guard a route by calling `requireSession(event, options?)` from its `load()` - it returns the current session, or throws SvelteKit's own `redirect()` to the login page (default `/login`, or `${authUrlPrefix}/login` for `redirect`/`popup` modes) when there's no active session:

```ts
// src/routes/profile/+page.server.ts
import type { PageServerLoad } from './$types';
import { sdk } from '$lib/server/strivacity';

export const load: PageServerLoad = async (event) => {
	const session = await sdk.requireSession(event, { returnTo: '/profile' });

	return { session };
};
```

> **Caveat**: `requireSession`'s `redirect()` only works as a genuine HTTP redirect when called from a `load()` whose page is actually rendered server-side. If your app disables SSR (`export const ssr = false`) and the login target isn't a real page route (the default `${authUrlPrefix}/login` for `redirect`/`popup` modes isn't - only `embedded`/`native` modes' `/login` page is), call `requireSession` from `hooks.server.ts`'s `handle` instead of a page's own `load()`, before/alongside `sdk.handle`. See the [example app](../../apps/sveltekit/src/routes/profile/+page.server.ts) for a working setup.

<a id="server-storages"></a>
### Storages

By default the Server SDK stores tokens encrypted in http-only cookies and login state in a global in-memory `Map`. Provide `storage`/`stateStorage` to use something else.

#### Built-in session storages

- **`createEncryptedCookieStorage(secret, options?)`** - default storage that keeps the session encrypted in an http-only cookie.
- **`createSessionIdCookieStorage(storage, options?)`** - puts only a small, random session-id cookie on the client and keeps the actual session payload in the `storage` you provide. This supports back-channel logout out of the box.

```ts
// src/lib/server/storage.ts
import { createSessionIdCookieStorage, createServerMemoryStorage } from '@strivacity/sdk-svelte/server/storages';

export const sessionStorage = createSessionIdCookieStorage(
	createServerMemoryStorage(),
	{
		// maxAge: 30 * 24 * 60 * 60 // Without maxAge this is a browser-session cookie that gets cleared when the browser closes
	}
);
```

```ts
// src/lib/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-svelte/server';
import { sdkOptions } from '../options';
import { sessionStorage } from './storage';

export const sdk = createServerSDK({
	...sdkOptions,
	storage: sessionStorage,
	postLoginRedirectUri: '/profile',
});
```

#### Custom storage

For example you can use Redis via [unstorage](https://npmjs.com/package/unstorage):

```ts
// src/lib/server/storage.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import type { SvelteKitServerStorage, SDKStorage } from '@strivacity/sdk-svelte/server';

const unstorageInstance = createStorage({ driver: redisDriver({ url: process.env.REDIS_URL }) });

// Custom session storage for tokens
export const sessionStorage: SvelteKitServerStorage = {
	async get(key) {
		return unstorageInstance.getItem<string>(key);
	},
	async set(key, value) {
		await unstorageInstance.setItem(key, value);
	},
	async delete(key) {
		await unstorageInstance.removeItem(key);
	},
	// Required for back-channel logout support - see below.
	// Scans all stored sessions and removes those matching the logout token's sid or sub claim.
	async deleteByLogoutToken(logoutToken) {
		const keys = await unstorageInstance.getKeys();
		await Promise.all(
			keys.map(async (key) => {
				const raw = await unstorageInstance.getItem<string>(key);
				if (!raw) return;
				const session = JSON.parse(raw);
				if ((logoutToken.sid && session.sid === logoutToken.sid) || (logoutToken.sub && session.sub === logoutToken.sub)) {
					await unstorageInstance.removeItem(key);
				}
			}),
		);
	},
};

// Custom state storage for the OAuth2 state parameter
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
// src/lib/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-svelte/server';
import { sdkOptions } from '../options';
import { sessionStorage, stateStorage } from './storage';

export const sdk = createServerSDK({
	...sdkOptions,
	storage: sessionStorage, // Custom Redis-backed session storage
	stateStorage, // Custom Redis-backed state storage
});
```

> For more details on the storage interfaces, see the core SDK's [Custom storage](../sdk-core/README.md#server-storages) section.

### Back-channel logout

OIDC back-channel logout lets the authorization server terminate sessions server-to-server, without involving the browser. When the IDP sends a logout event (e.g. an admin terminates a session, or the user logs out from a different device), it POSTs a signed `logout_token` JWT to `/auth/backchannel-logout` - already wired up by the `handle` hook from [Setup](#setup) - which routes it to `sdk.handleBackChannelLogout(event)`.

The handler verifies the token's signature against the IDP's JWKS, validates the `iss`, `aud`, `iat` (freshness), and `jti` (replay protection) claims, requires the `http://schemas.openid.net/event/backchannel-logout` event and a `sid` or `sub` claim, then calls `storage.deleteByLogoutToken({ sid?, sub? })` to remove the matching session(s). It responds `200` on success, `400` for an invalid or malformed `logout_token`, and `501` if the configured storage doesn't implement `deleteByLogoutToken`.

> **The default encrypted-cookie storage does not support back-channel logout** because each cookie is bound to a single browser session - there is no server-side index to look up by `sid` or `sub`. To support back-channel logout, use [`createSessionIdCookieStorage`](#server-storages) with a `storage` that implements `deleteByLogoutToken` (e.g. `createServerMemoryStorage()` for local testing), or a fully custom server storage as shown in the [Custom storage](#server-storages) example above.

Configure the **Back-channel logout URI** in your Strivacity application settings to:

```
https://your-app.example.com/auth/backchannel-logout
```

For a complete explanation of the handshake and validation performed, see the core SDK's [Back-channel logout](../sdk-core/README.md#server-backchannel-logout) documentation.

### Server SDK API reference

```ts
{
	options: ServerSDKOptions; // resolved server SDK configuration

	// Session management
	getSession(event?): Promise<SessionData | null>; // read the current session
	updateSession(session, event?): Promise<void>; // persist new session data
	refreshSession(event?): Promise<SessionData>; // refresh tokens using the refresh token
	revokeSession(event?): Promise<void>; // revoke tokens and clear the session
	getEntrySession(entryUrl): Promise<Record<string, string>>; // resolve an externally-initiated (embedded/native) entry URL
	completeLogin(params, event?): Promise<SessionData>; // exchange an authorization code for tokens
	logout(postLogoutRedirectUri, event?): Promise<URL>; // clear the session, returns the IDP end-session URL

	// Route handlers - each returns a Response
	handleLogin(event): Promise<Response>;
	handleRegister(event): Promise<Response>;
	handleCallback(event): Promise<Response>;
	handleRefresh(event): Promise<Response>;
	handleRevoke(event): Promise<Response>;
	handleEntry(event): Promise<Response>;
	handleLogout(event): Promise<Response>;
	handleBackChannelLogout(event): Promise<Response>;

	// SvelteKit-specific
	handle: Handle; // see Setup
	requireSession(event, options?): Promise<SessionData>; // see Accessing the session server-side
}
```

### Server configuration reference

The Server SDK accepts the same configuration as the client SDK (see [Configuration reference](#configuration-reference)), plus:

| Option | Type | Required | Default | Description |
| ------ | ---- | -------- | ------- | ----------- |
| `secret` | `string` | Only if using default storage | - | Encryption key (32+ random characters) for the http-only cookie session storage |
| `storage` | `SvelteKitServerStorage` | No | Encrypted cookie storage | Custom session storage; see [Storages](#server-storages) |
| `stateStorage` | `SDKStorage` | No | In-memory `Map` | Custom OAuth2 state storage |
| `authUrlPrefix` | `string` | No | `'/auth'` | URL prefix matched by `handle` |
| `loginUri` | `string` | No | `'/login'` | Route `requireSession` redirects to when there's no session (`embedded`/`native` modes only - `redirect`/`popup` modes always use `${authUrlPrefix}/login`) |
| `postLoginRedirectUri` | `string` | No | - | Default redirect after login when no `?returnTo=` is given |
| `postLogoutRedirectUri` | `string` | No | - | Default redirect after logout |
| `cookieMaxAge` | `number` | No | `2592000` (30 days) | Max age of the session cookie in seconds |

---

## Route guards

- **Client-side**: there's no dedicated guard helper - check `ctx.isAuthenticated` (after `ctx.loading` becomes `false`) in `onMount` and redirect with `goto()`/`location.href` if it's `false`.
- **Server-side**: call [`requireSession(event, options?)`](#accessing-the-session-server-side) from a `+page.server.ts`/`+layout.server.ts` `load()` - see the caveat about non-page login targets under SSR-disabled apps documented there.

---

## Shared features

The Svelte SDK is built on top of the core SDK and supports all its features, on both the client and server:

- **[Storages](../sdk-core/README.md#storages)** - localStorage, sessionStorage, IndexedDB, Cache API, Memory, Worker (client), encrypted cookies, in-memory (server)
- **[SDK events](../sdk-core/README.md#sdk-events)** - Subscribe to authentication lifecycle events
- **[Logging](../sdk-core/README.md#logging)** - Built-in and custom logger support
- **[HTTP client](../sdk-core/README.md#http-client)** - Custom HTTP client integration
- **[Error handling](../sdk-core/README.md#error-handling)** - Typed error classes for different failure scenarios
- **[Utility functions](../sdk-core/README.md#utility-functions)** - Base64URL, JWT decoding, encryption, etc.
- **[Caching](../sdk-core/README.md#caching)** - OIDC metadata and JWKS caching

---

## Configuration reference

The client SDK accepts the same configuration as the core SDK - see the [core SDK configuration reference](../sdk-core/README.md#configuration-reference). See [Server configuration reference](#server-configuration-reference) above for the additional server-specific options.

---

## Migration guide

### Migrating to v4.0

v4 replaces the SDK's class-based flow architecture with function-based architecture, and adds a first-class Server SDK for server-managed (BFF) sessions. `useStrivacity()`, `useNativeLogin()`, and the built-in `redirect`/`popup`/`embedded`/`native` modes are unchanged - only apps that used `mode: 'custom'` or drove `native` mode through the old `NativeFlowHandler` need to update their code.

#### Class-based flows replaced by functions

In v3, flows were classes (`RedirectFlow`, `PopupFlow`, `NativeFlow`, `EmbeddedFlow`), and the only way to customize behavior beyond the built-in modes - for example, to proxy authentication through your own backend in a bespoke way - was `mode: 'custom'` with a `customFlow` class that extended one of them and override its methods:

```ts
// v3
import { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';

export class CustomNativeFlow extends NativeFlow {
	override async refresh(): Promise<void> {
		// ...
	}
}
```

v4 removes `mode: 'custom'`, the `customFlow` option, and the flow classes entirely. In their place, `createBaseFlow` (from `@strivacity/sdk-core/flows/base`) is a factory function that returns a plain object of methods closing over shared state - build your own flow by composing it, without extending anything:

```ts
// v4
import { createBaseFlow } from '@strivacity/sdk-core/flows/base';
import { getDefaultFlowState, getSDKOptions } from '@strivacity/sdk-core/utils';
import type { SDKInitConfig, SDKOptions } from '@strivacity/sdk-core/types';

export function createCustomFlow(initConfig: SDKInitConfig) {
	const state = getDefaultFlowState();
	const options = getSDKOptions<SDKOptions>(state, initConfig);
	const base = createBaseFlow(state, options);

	async function refresh(): Promise<void> {
		// ...
	}

	return { ...base, refresh };
}
```

This is a low-level `@strivacity/sdk-core` primitive - it's used the same way no matter which framework package you build on top of it. Wire it up by adding `factory: createCustomFlow` to your shared `sdkOptions` - see [Custom flow](../sdk-core/README.md#custom-flow) in the core SDK README for the full pattern and usage example.

#### Server-managed sessions (BFF) are now built in

In v3, routing authentication through your own backend meant writing a custom flow class like the one above yourself: manually calling `fetch()` against hand-written endpoints, and reimplementing PKCE/state handling, CSRF protection, and server-side token storage on your own.

v4 replaces that with the Server SDK shown in [Quick start](#quick-start) above: add `serverSessionUri` to your shared `sdkOptions`, create the server side with `createServerSDK` from `@strivacity/sdk-svelte/server`, and export its `handle` hook from `src/hooks.server.ts` - PKCE, state, and session storage are all handled by the Server SDK:

```ts
// src/lib/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-svelte/server';
import { sdkOptions } from '../options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // http-only cookie encryption key (random 32+ characters)
});
```

#### Native mode: no more `NativeFlowHandler`

In v3, `native` mode's `login()`/`register()` returned a separate `NativeFlowHandler` instance, and the flow was driven through that handler:

```ts
// v3
const handler = await sdk.login();
const state = await handler.startSession(sessionId);
const nextState = await handler.submitForm('formId', { identifier: 'user@example.com' });
await handler.finalizeSession(nextState.finalizeUrl);
```

v4 moves `startSession()`, `submitForm()`, and `finalizeSession()` directly onto the flow itself - in `@strivacity/sdk-svelte` this is wrapped for you by the [`useNativeLogin()`](#usenativelogin) function:

```ts
import { useNativeLogin } from '@strivacity/sdk-svelte/client';

// v4
const ctx = useNativeLogin({
	params: { sessionId },
});

await ctx.submitForm('formId');
```

Update any code that calls `login()`/`register()` and drives the returned handler in `native` mode to use `useNativeLogin()` instead.

## Migrating to v3.0

### Entry API Major Changes

Strivacity SDK's `entry()` API now returns a structured object instead of a plain string. Check the example above in the usage section for more details.

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
