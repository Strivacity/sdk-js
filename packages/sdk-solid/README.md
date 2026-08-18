# @strivacity/sdk-solid

SolidJS SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Solid application. Ships with a client SDK and a backend-for-frontend ([BFF](../../README.md#bff)) Server SDK that runs entirely inside your app as a `FetchMiddleware` - no separate backend required.

Built on top of [@strivacity/sdk-core](../sdk-core) - see the [core SDK documentation](../sdk-core/README.md) for detailed information about authentication flows, configuration options, and advanced features.

**See also:**
- [Full Documentation](https://docs.strivacity.com/reference/overview) - Complete guide for all authentication modes
- [Example App](../../apps/solidstart) - Working Solid example covering both client-managed and server-managed sessions
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
    - [withAuthGuard (client)](#withauthguard-client)
- [Server SDK](#server-sdk)
  - [Setup](#setup)
  - [Accessing the session server-side](#accessing-the-session-server-side)
  - [Route guards](#route-guards)
  - [Storages](#server-storages)
  - [Back-channel logout](#back-channel-logout)
  - [Server SDK API reference](#server-sdk-api-reference)
  - [Server configuration reference](#server-configuration-reference)
- [Shared features](#shared-features)
- [Configuration reference](#configuration-reference)
- [Migration guide](#migration-guide)
- [Vulnerability Reporting](#vulnerability-reporting)
- [License](#license)
- [Contributing](#contributing)

---

## Prerequisites

- Solid 2.0+ (`solid-js`, `@solidjs/web`)
- `@solidjs/vite-plugin`'s "start" mode for server-managed sessions (SSR + `serverFunctions`)
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-solid
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
// src/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-solid/client';

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

Only needed for server-managed sessions - skip this step (and step 3's middleware) if you're using client-managed sessions.

```ts
// src/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-solid/server';
import { sdkOptions } from '../options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // http-only cookie encryption key (random 32+ characters)
	postLoginRedirectUri: '/profile',
});
```

### 3. Wire up the middleware

A single `FetchMiddleware` handles every auth route automatically - `sdk.middleware` inspects the request path and either serves it directly or calls `next(request)` to fall through to the app:

```ts
// src/middleware.ts
import type { FetchMiddleware } from '@solidjs/web';
import { sdk } from './server/strivacity';

const middleware: FetchMiddleware = (request, next) => sdk.middleware(request, next);

export default middleware;
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import solid from '@solidjs/vite-plugin';

export default defineConfig({
	plugins: [
		solid({
			start: { middleware: './src/middleware.ts' },
			ssr: true, // required for server-managed sessions
			serverFunctions: true, // required to read the session server-side, see step 4
		}),
	],
});
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

> The `/auth` prefix and route names come from `authUrlPrefix` - see [Server configuration reference](#server-configuration-reference). Everything else falls through to `next(request)`, so the middleware is safe to compose with your own (or other libraries').

### 4. Wrap your app with the client provider

For client-managed sessions, mount `StyAuthProvider` once near the root of your app - the client SDK loads and manages the session itself:

```tsx
// src/App.tsx
import type { ParentProps } from 'solid-js';
import { StyAuthProvider } from '@strivacity/sdk-solid/client';
import { sdkOptions } from './options';

export default function App(props: ParentProps) {
	return <StyAuthProvider options={sdkOptions}>{props.children}</StyAuthProvider>;
}
```

For server-managed sessions, resolve the session once per request through a `"use server"` function and read it via a `createMemo`/`<Loading>` boundary - this is Solid 2.0's sanctioned way of carrying an SSR-resolved value into client hydration (no manual serialization needed):

```ts
// src/server/session.ts
import type { SessionData } from '@strivacity/sdk-solid/client';
import { sdk } from './strivacity';

export async function getSession(): Promise<SessionData | null> {
	'use server';

	return await sdk.getSession();
}
```

```tsx
// src/App.tsx
import type { ParentProps } from 'solid-js';
import { createMemo, Loading } from 'solid-js';
import { StyAuthProvider } from '@strivacity/sdk-solid/client';
import { sdkOptions } from './options';
import { getSession } from './server/session';

export default function App(props: ParentProps) {
	const session = createMemo(() => getSession());

	return (
		<Loading fallback={<main>Loading...</main>}>
			<StyAuthProvider options={sdkOptions} session={session()}>
				{props.children}
			</StyAuthProvider>
		</Loading>
	);
}
```

---

## Client SDK

### Authentication modes

The `mode` set in `src/options.ts` (see [Quick start](#quick-start)) controls which of the four flows below is active - the `StyAuthProvider` bootstrap shown in the [core SDK docs](../sdk-core/README.md#choosing-a-mode) is already handled by `src/App.tsx`, so the examples below start directly from the route level.

#### redirect mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The current browser tab navigates to the Strivacity-hosted login page and back to the configured `redirectUri` after authentication.

##### Login

**Client-managed sessions**:

Call this to start the login flow. It redirects the user to the Strivacity login page in the current browser tab, where they authenticate.

```tsx
// src/routes/login.tsx
import { onSettled } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import type { RedirectFlow } from '@strivacity/sdk-solid/client';

export default function LoginPage() {
	const ctx = useStrivacity<RedirectFlow>();

	onSettled(() => {
		void ctx.login({
			// Optional parameters
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
		});
	});

	return (
		<section>
			<h1>Redirecting to login...</h1>
		</section>
	);
}
```

**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/login` - the middleware from [Quick start](#quick-start) intercepts the request and the Server SDK builds the authorization request and redirects to the IDP:

```tsx
// src/routes/login.tsx
import { onSettled } from 'solid-js';

export default function LoginPage() {
	onSettled(() => {
		globalThis.location.href = '/auth/login';
	});

	return null;
}
```

##### Handle the callback

**Client-managed sessions**:

Call this on your redirect URI route after the IDP sends the user back. It parses the query parameters from the callback URL, verifies the state matches what was stored during login (CSRF protection), exchanges the authorization code for tokens using PKCE, validates the ID token, and stores the session in the [configured storage](../sdk-core/README.md#storages).

```tsx
// src/routes/callback.tsx
import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function CallbackPage() {
	const ctx = useStrivacity();
	const navigate = useNavigate();
	const searchParams = new URLSearchParams(globalThis.location.search);

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			if (searchParams.get('error')) {
				navigate(`/error?${searchParams.toString()}`, { replace: true });
				return;
			}

			ctx
				.handleCallback()
				.then(() => navigate('/profile'))
				.catch((error) => navigate(`/error?message=${encodeURIComponent(error.message)}`));
		},
	);

	return (
		<section>
			<h1>Logging in...</h1>
		</section>
	);
}
```

**Server-managed sessions**:

Forward the callback query string to `/auth/callback` - the Server SDK completes the code exchange and redirects to `postLoginRedirectUri`:

```tsx
// src/routes/callback.tsx
import { onSettled } from 'solid-js';

export default function CallbackPage() {
	onSettled(() => {
		globalThis.location.href = `/auth/callback${globalThis.location.search}`;
	});

	return (
		<section>
			<h1>Logging in...</h1>
		</section>
	);
}
```

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```tsx
// src/routes/register.tsx
import { onSettled } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import type { RedirectFlow } from '@strivacity/sdk-solid/client';

export default function RegisterPage() {
	const ctx = useStrivacity<RedirectFlow>();

	onSettled(() => {
		void ctx.register({
			loginHint: 'user@example.com',
		});
	});

	return (
		<section>
			<h1>Redirecting to registration...</h1>
		</section>
	);
}
```

**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/register` - the Server SDK builds the registration request and redirects to the IDP:

```tsx
// src/routes/register.tsx
import { onSettled } from 'solid-js';

export default function RegisterPage() {
	onSettled(() => {
		globalThis.location.href = '/auth/register';
	});

	return null;
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// src/routes/logout.tsx
import { createEffect } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function LogoutPage() {
	const ctx = useStrivacity();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			void ctx.logout();
		},
	);

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```tsx
// src/routes/logout.tsx
import { onSettled } from 'solid-js';

export default function LogoutPage() {
	onSettled(() => {
		globalThis.location.href = '/auth/logout';
	});

	return null;
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```tsx
import { Show } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export function TokenPanel() {
	const ctx = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await ctx.refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await ctx.revoke();
	}

	// idTokenClaims/accessToken/refreshToken are accessors - call them to read the current value;
	// they update automatically whenever the SDK's session changes
	return (
		<Show when={!ctx.loading()}>
			<div>
				<button onClick={onRefresh}>Refresh</button>
				<button onClick={onRevoke}>Revoke</button>
				<pre>{JSON.stringify({ idTokenClaims: ctx.idTokenClaims(), accessToken: ctx.accessToken(), refreshToken: ctx.refreshToken() }, null, 2)}</pre>
			</div>
		</Show>
	);
}
```


**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the middleware redirect back:

```tsx
export function TokenPanel() {
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		globalThis.location.href = '/auth/revoke';
	}

	return (
		<div>
			<button onClick={onRefresh}>Refresh</button>
			<button onClick={onRevoke}>Revoke</button>
		</div>
	);
}
```

---

#### popup mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The Strivacity login page opens in a separate window or tab. After authentication the opened window or tab closes itself and the parent page receives the session - no full-page navigation required.

##### Login

**Client-managed sessions**:

Call this to start the login flow. It opens a popup window by default with the Strivacity login page, where the user authenticates. After that the popup closes itself and the session is stored in the [configured storage](../sdk-core/README.md#storages).

By default a centered popup window opens. Pass `popupWindowTarget` to change where the window opens, and `popupWindowFeatures` to control its size and position:

```tsx
// src/routes/login.tsx
import { onSettled } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import type { PopupFlow } from '@strivacity/sdk-solid/client';

export default function LoginPage() {
	const ctx = useStrivacity<PopupFlow>();
	const navigate = useNavigate();

	onSettled(() => {
		ctx
			.login({
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
			})
			.then(() => navigate('/profile'))
			.catch((error) => navigate(`/error?message=${encodeURIComponent(error.message)}`));
	});

	return (
		<section>
			<h1>Opening login popup...</h1>
		</section>
	);
}
```

**Server-managed sessions**:

Popup mode always needs client-side JavaScript to open the window, so there's no server-only alternative here.

##### Handle the callback

**Client-managed sessions**:

The popup resolves automatically - no callback route is needed. Token exchange happens inside the popup and the result is posted back to the opener window.

**Server-managed sessions**:

Same as client managed - the popup's internal callback request is also transparently proxied through `/auth/callback`, and the result is posted back to the opener window exactly the same way.

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```tsx
// src/routes/register.tsx
import { onSettled } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import type { PopupFlow } from '@strivacity/sdk-solid/client';

export default function RegisterPage() {
	const ctx = useStrivacity<PopupFlow>();
	const navigate = useNavigate();

	onSettled(() => {
		ctx
			.register({
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
			})
			.then(() => navigate('/profile'))
			.catch((error) => navigate(`/error?message=${encodeURIComponent(error.message)}`));
	});

	return (
		<section>
			<h1>Opening registration popup...</h1>
		</section>
	);
}
```

**Server-managed sessions**:

Popup mode always needs client-side JavaScript to open the window, so there's no server-only alternative here.

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// src/routes/logout.tsx
import { createEffect } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function LogoutPage() {
	const ctx = useStrivacity();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			void ctx.logout();
		},
	);

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```tsx
// src/routes/logout.tsx
import { onSettled } from 'solid-js';

export default function LogoutPage() {
	onSettled(() => {
		globalThis.location.href = '/auth/logout';
	});

	return null;
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```tsx
import { Show } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export function TokenPanel() {
	const ctx = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await ctx.revoke();
	}

	// idTokenClaims/accessToken/refreshToken are accessors - call them to read the current value;
	// they update automatically whenever the SDK's session changes
	return (
		<Show when={!ctx.loading()}>
			<div>
				<button onClick={onRefresh}>Refresh</button>
				<button onClick={onRevoke}>Revoke</button>
				<pre>{JSON.stringify({ idTokenClaims: ctx.idTokenClaims(), accessToken: ctx.accessToken(), refreshToken: ctx.refreshToken() }, null, 2)}</pre>
			</div>
		</Show>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the middleware redirect back:

```tsx
export function TokenPanel() {
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		globalThis.location.href = '/auth/revoke';
	}

	return (
		<div>
			<button onClick={onRefresh}>Refresh</button>
			<button onClick={onRevoke}>Revoke</button>
		</div>
	);
}
```

---

#### embedded mode

> For details on how this mode works, see the [embedded journey documentation](https://docs.strivacity.com/reference/embedded-journey).

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your Strivacity tenant cluster once, on the login route:

##### Login / Register

**Client-managed sessions**:

```tsx
// src/routes/login.tsx
import { onSettled } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useStrivacity, injectScript } from '@strivacity/sdk-solid/client';
import type { LoginComponent } from '@strivacity/sdk-solid/client/types';

export default function LoginPage() {
	const navigate = useNavigate();
	const ctx = useStrivacity();
	const [searchParams] = useSearchParams();
	let loginRef: LoginComponent | undefined;

	onSettled(() => {
		// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
		// custom element definitions from the auth server
		injectScript('sty-components', `${ctx.sdk.options.issuer}/assets/components/bundle.js`);

		const element = loginRef;

		if (!element) {
			return;
		}

		element.params = {
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			language: 'en-US', // set the UI language (BCP 47 language tag)
			prompt: 'login', // use 'create' to open the registration flow instead
		};
		// Optional: Resume a session started from an entry URL (e.g., password reset)
		element.sessionId = (searchParams.session_id as string | undefined) ?? null;
		element.shortAppId = (searchParams.short_app_id as string | undefined) ?? null;
		element.lang = (searchParams.language as string | undefined) ?? globalThis.navigator?.language;

		const onLogin = () => navigate('/profile');
		const onClose = () => globalThis.location.reload();
		const onError = (event: Event) => navigate(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('close', onClose);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('close', onClose);
			element.removeEventListener('error', onError);
		};
	});

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={(el) => (loginRef = el)}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - the `<sty-login>` component's internal requests are transparently proxied through `/auth/login`/`/auth/register` instead of going straight to the IDP.

##### Controlling when the flow starts

By default the login flow starts automatically as soon as `<sty-login>` connects to the DOM. Add the `lazy` attribute to take manual control, then call `start()` when ready. `start()` accepts an optional params object forwarded to the authorization request, or you can set params via the `params` property before calling it:

```tsx
// src/routes/login.tsx
import { useNavigate } from '@solidjs/router';
import type { LoginComponent } from '@strivacity/sdk-solid/client/types';

export function LazyLogin() {
	const navigate = useNavigate();
	let loginRef: LoginComponent | undefined;

	async function onStartClick() {
		await loginRef?.start({
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			language: 'en-US', // set the UI language (BCP 47 language tag)
			prompt: 'login', // use 'create' to open the registration flow instead
		});
	}

	return (
		<section>
			<sty-notifications></sty-notifications>
			<button onClick={onStartClick}>Continue to login</button>
			<sty-login ref={(el) => (loginRef = el)} lazy onLogin={() => navigate('/profile')}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

You can also set params via the `params` property before calling `start()`:

```tsx
// src/routes/login.tsx
import type { LoginComponent } from '@strivacity/sdk-solid/client/types';

export function LazyLogin() {
	let loginRef: LoginComponent | undefined;

	async function onStartClick() {
		if (!loginRef) {
			return;
		}

		loginRef.params = {
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			language: 'en-US', // set the UI language (BCP 47 language tag)
			prompt: 'login', // use 'create' to open the registration flow instead
		};
		await loginRef.start();
	}

	return (
		<>
			<sty-login ref={(el) => (loginRef = el)} lazy></sty-login>
			<button onClick={onStartClick}>Start Login</button>
		</>
	);
}
```

##### Login events

The `<sty-login>` element dispatches `login`, `close`, and `error` custom events. Attach listeners on the element ref inside `onSettled`:

```tsx
// src/routes/login.tsx
import { onSettled } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { LoginComponent } from '@strivacity/sdk-solid/client/types';

export function CustomLogin() {
	const navigate = useNavigate();
	let loginRef: LoginComponent | undefined;

	onSettled(() => {
		const element = loginRef;

		if (!element) {
			return;
		}

		const onLogin = () => {
			// User authenticated - navigate to a protected page
			navigate('/profile');
		};
		const onClose = () => {
			// User cancelled or closed the login flow
			globalThis.location.reload();
		};
		const onError = (event: Event) => {
			// A fatal error occurred - the message is available in event.detail
			navigate(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);
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

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={(el) => (loginRef = el)}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

##### Notification events

The components dispatch `notification` events on the `document` that the `<sty-notifications>` component automatically displays. If you don't want to use `<sty-notifications>`, you can listen to these events and handle them yourself:

```tsx
import { onSettled } from 'solid-js';

export function CustomNotifications() {
	onSettled(() => {
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

	return null;
}
```

##### Dynamic language switching

The `<sty-language-selector>` component provides a built-in UI for language switching. If you don't want to use it, you can change the UI language dynamically by updating the `lang` property on the `<sty-login>` component:

```tsx
import { createSignal } from 'solid-js';

export function LanguageSwitcher() {
	let loginRef: (HTMLElement & { lang: string }) | undefined;
	const [currentLang, setCurrentLang] = createSignal('en-US');

	function changeLanguage(lang: string) {
		setCurrentLang(lang);

		if (loginRef) {
			loginRef.lang = lang;
		}
	}

	return (
		<section>
			<div>
				<button onClick={() => changeLanguage('en-US')}>English</button>
				<button onClick={() => changeLanguage('fr-FR')}>Français</button>
				<button onClick={() => changeLanguage('de-DE')}>Deutsch</button>
			</div>
			<sty-login ref={(el: typeof loginRef) => (loginRef = el)} lang={currentLang()}></sty-login>
		</section>
	);
}
```

##### Handle the callback

**Client-managed sessions**:

No separate callback route is needed. The `<sty-login>` component handles the entire authentication flow automatically, including token exchange, and dispatches a `login` event when authentication completes successfully.

**Server-managed sessions**:

Same as client managed - the component's internal callback request is also transparently proxied through `/auth/callback`, with no separate route needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing route to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login route**

Forward the parameters as query params to your login route:

```tsx
// src/routes/entry.tsx
import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import type { EmbeddedFlow } from '@strivacity/sdk-solid/client';

export default function EntryPage() {
	const ctx = useStrivacity<EmbeddedFlow>();
	const navigate = useNavigate();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			ctx
				.entry()
				.then((data) => {
					// Redirect to login route with flow parameters
					const params = new URLSearchParams({
						session_id: data.session_id,
						short_app_id: data.short_app_id,
						language: data.language,
					});
					globalThis.location.href = `/login?${params}`;
				})
				.catch((error) => navigate(`/error?message=${encodeURIComponent(error.message)}`));
		},
	);

	return (
		<section>
			<h1>Loading...</h1>
		</section>
	);
}
```

Then on your login route, read the parameters and pass them to `<sty-login>`:

```tsx
// src/routes/login.tsx
import { onSettled } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import type { LoginComponent } from '@strivacity/sdk-solid/client/types';

export default function LoginPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	// Read parameters from URL
	const sessionId = searchParams.session_id as string | undefined;
	const shortAppId = searchParams.short_app_id as string | undefined;
	const language = searchParams.language as string | undefined;
	let loginRef: LoginComponent | undefined;

	onSettled(() => {
		const element = loginRef;

		if (!element) {
			return;
		}

		element.sessionId = sessionId ?? null;
		element.shortAppId = shortAppId ?? null;
		element.lang = language ?? null;

		const onLogin = () => navigate('/profile');
		const onError = (event: Event) => navigate(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('error', onError);
		};
	});

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={(el) => (loginRef = el)}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

**Option 2: Render login on the entry route**

Pass the parameters directly to `<sty-login>` on the same route:

```tsx
// src/routes/entry.tsx
import { createEffect, createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import type { LoginComponent } from '@strivacity/sdk-solid/client/types';
import type { EmbeddedFlow } from '@strivacity/sdk-solid/client';

export default function EntryPage() {
	const ctx = useStrivacity<EmbeddedFlow>();
	const navigate = useNavigate();
	let loginRef: LoginComponent | undefined;

	const [sessionId, setSessionId] = createSignal<string | null>(null);
	const [shortAppId, setShortAppId] = createSignal<string | null>(null);
	const [language, setLanguage] = createSignal<string | null>(null);

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			ctx
				.entry()
				.then((data) => {
					// Set state for sty-login component
					setSessionId(data.session_id);
					setShortAppId(data.short_app_id);
					setLanguage(data.language);
				})
				.catch((error) => navigate(`/error?message=${encodeURIComponent(error.message)}`));
		},
	);

	createEffect(
		() => sessionId(),
		(currentSessionId) => {
			const element = loginRef;

			if (!element || !currentSessionId) {
				return;
			}

			element.sessionId = currentSessionId;
			element.shortAppId = shortAppId();
			element.lang = language();

			const onLogin = () => navigate('/profile');
			const onError = (event: Event) => navigate(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

			element.addEventListener('login', onLogin);
			element.addEventListener('error', onError);

			return () => {
				element.removeEventListener('login', onLogin);
				element.removeEventListener('error', onError);
			};
		},
	);

	return (
		<Show
			when={sessionId()}
			fallback={
				<section>
					<h1>Loading...</h1>
				</section>
			}
		>
			<section>
				<sty-notifications></sty-notifications>
				<sty-login ref={(el) => (loginRef = el)}></sty-login>
				<sty-language-selector></sty-language-selector>
			</section>
		</Show>
	);
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// src/routes/logout.tsx
import { createEffect } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function LogoutPage() {
	const ctx = useStrivacity();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			void ctx.logout();
		},
	);

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```tsx
// src/routes/logout.tsx
import { onSettled } from 'solid-js';

export default function LogoutPage() {
	onSettled(() => {
		globalThis.location.href = '/auth/logout';
	});

	return null;
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```tsx
import { Show } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export function TokenPanel() {
	const ctx = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await ctx.refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await ctx.revoke();
	}

	// idTokenClaims/accessToken/refreshToken are accessors - call them to read the current value;
	// they update automatically whenever the SDK's session changes
	return (
		<Show when={!ctx.loading()}>
			<div>
				<button onClick={onRefresh}>Refresh</button>
				<button onClick={onRevoke}>Revoke</button>
				<pre>{JSON.stringify({ idTokenClaims: ctx.idTokenClaims(), accessToken: ctx.accessToken(), refreshToken: ctx.refreshToken() }, null, 2)}</pre>
			</div>
		</Show>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the middleware redirect back:

```tsx
export function TokenPanel() {
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		globalThis.location.href = '/auth/revoke';
	}

	return (
		<div>
			<button onClick={onRefresh}>Refresh</button>
			<button onClick={onRevoke}>Revoke</button>
		</div>
	);
}
```

---

#### native mode

> For details on how this mode works, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey).

You build the entire login UI with your own components. `useNativeLogin()` drives a "headless" auth flow: instead of redirecting to a hosted page, the SDK returns a JSON description of the current screen that you render yourself, submit each form step with `submitForm()`, and repeat until the flow finalizes automatically.

> If you split widget rendering into separate sub-components, they'll need access to the login context returned by `useNativeLogin()` - see [useNativeLogin](#usenativelogin) below.
>
> The example below shows a simplified custom implementation. For a complete native renderer with all widget types, see the [example app](../../apps/solidstart/src/components/auth/native/NativeLogin.tsx).

##### Login / Register

**Client-managed sessions**:

```tsx
// src/routes/login.tsx
import { Show, Switch, Match } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useNativeLogin } from '@strivacity/sdk-solid/client';

export default function LoginPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const ctx = useNativeLogin({
		params: {
			prompt: 'login', // use 'create' to open the registration flow instead
			language: 'en-US', // set the UI language (BCP 47 language tag)
			sdk: 'web-minimal', // rendering mode: 'web-minimal' for simplified rendering, 'web' (default) for full rendering hints and branding
			sessionId: searchParams.session_id as string | undefined, // pass a session ID to resume an existing flow
		},
		onLogin: async () => {
			navigate('/profile');
		},
		onClose: () => {
			globalThis.location.reload();
		},
		onError: async (error) => {
			navigate(`/error?message=${encodeURIComponent(error.message)}`);
		},
		onFallback: (error) => {
			// Fallback to hosted journey if native widget not supported
			globalThis.location.href = error.url.toString();
		},
		onGlobalMessage: (message) => {
			alert(message.text);
		},
	});

	return (
		<Show
			when={!ctx.loading() && ctx.state().screen}
			fallback={
				<section>
					<h1>Loading...</h1>
				</section>
			}
		>
			<Switch>
				<Match when={ctx.state().screen === 'identifier'}>
					<section>
						<h2>Sign In</h2>
						<form
							onSubmit={async (event) => {
								event.preventDefault();
								await ctx.submitForm('identifier');
							}}
						>
							<input
								type="text"
								placeholder="Email"
								value={(ctx.forms().identifier?.identifier as string) ?? ''}
								onInput={(event) => ctx.setFormValue('identifier', 'identifier', event.currentTarget.value)}
							/>
							<Show when={ctx.messages().identifier?.identifier}>
								<div class="error">{ctx.messages().identifier.identifier.text}</div>
							</Show>
							<button type="submit">Continue</button>
						</form>
					</section>
				</Match>
				<Match when={ctx.state().screen === 'password'}>
					<section>
						<h2>Enter Password</h2>
						<form
							onSubmit={async (event) => {
								event.preventDefault();
								await ctx.submitForm('password');
							}}
						>
							<input
								type="password"
								placeholder="Password"
								value={(ctx.forms().password?.password as string) ?? ''}
								onInput={(event) => ctx.setFormValue('password', 'password', event.currentTarget.value)}
							/>
							<Show when={ctx.messages().password?.password}>
								<div class="error">{ctx.messages().password.password.text}</div>
							</Show>
							<button type="submit">Sign In</button>
						</form>
					</section>
				</Match>
			</Switch>
		</Show>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - `useNativeLogin`'s internal requests are transparently proxied through your server instead of going straight to the IDP.

##### Handle the callback

**Client-managed sessions**:

No separate callback route is needed. Once `state().finalizeUrl` is set, `submitForm()` automatically finalizes the session internally to exchange the authorization code for tokens and store it.

**Server-managed sessions**:

Same as client managed - finalizing the session also transparently proxies through your server, with no separate route needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing route to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login route**

```tsx
// src/routes/entry.tsx
import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import type { NativeFlow } from '@strivacity/sdk-solid/client';

export default function EntryPage() {
	const ctx = useStrivacity<NativeFlow>();
	const navigate = useNavigate();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			ctx
				.entry()
				.then((data) => {
					const params = new URLSearchParams({
						session_id: data.session_id,
						short_app_id: data.short_app_id,
						language: data.language,
					});
					globalThis.location.href = `/login?${params}`;
				})
				.catch((error) => navigate(`/error?message=${encodeURIComponent(error.message)}`));
		},
	);

	return (
		<section>
			<h1>Loading...</h1>
		</section>
	);
}
```

Then on your login route, read query parameters from the URL and pass it to `useNativeLogin` to resume the flow, exactly as shown in the Login / Register example above:

```tsx
// src/routes/login.tsx
import { useSearchParams } from '@solidjs/router';
import { useNativeLogin } from '@strivacity/sdk-solid/client';

export default function LoginPage() {
	const [searchParams] = useSearchParams();

	const ctx = useNativeLogin({
		params: {
			sessionId: searchParams.session_id as string | undefined,
			language: searchParams.language as string | undefined,
		},
		onLogin: async () => {
			globalThis.location.href = '/profile';
		},
	});

	// ...render based on `ctx.state().screen` as shown in the Login / Register example above
}
```

**Option 2: Render login on the entry route**

Call `useNativeLogin` directly inside `src/routes/entry.tsx`, feeding it the `session_id` resolved from `entry()` - no redirect needed:

```tsx
// src/routes/entry.tsx
import { createEffect, createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity, useNativeLogin } from '@strivacity/sdk-solid/client';
import type { NativeFlow } from '@strivacity/sdk-solid/client';

export default function EntryPage() {
	const sdkCtx = useStrivacity<NativeFlow>();
	const navigate = useNavigate();
	const [sessionId, setSessionId] = createSignal<string | null>(null);
	const [language, setLanguage] = createSignal<string | null>(null);
	const [ready, setReady] = createSignal(false);

	createEffect(
		() => sdkCtx.loading(),
		(sdkLoading) => {
			if (sdkLoading) {
				return;
			}

			sdkCtx
				.entry()
				.then((data) => {
					setSessionId(data.session_id);
					setLanguage(data.language);
					setReady(true);
				})
				.catch((error) => navigate(`/error?message=${encodeURIComponent(error.message)}`));
		},
	);

	const ctx = useNativeLogin({
		params: { sessionId: sessionId() ?? undefined, language: language() ?? undefined },
		onLogin: async () => {
			navigate('/profile');
		},
		onError: async (error) => {
			navigate(`/error?message=${encodeURIComponent(error.message)}`);
		},
	});

	return (
		<Show
			when={ready() && !ctx.loading() && ctx.state().screen}
			fallback={
				<section>
					<h1>Loading...</h1>
				</section>
			}
		>
			{/* ...render based on `ctx.state().screen` as shown in the Login / Register example above */}
		</Show>
	);
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// src/routes/logout.tsx
import { createEffect } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function LogoutPage() {
	const ctx = useStrivacity();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			void ctx.logout();
		},
	);

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```tsx
// src/routes/logout.tsx
import { onSettled } from 'solid-js';

export default function LogoutPage() {
	onSettled(() => {
		globalThis.location.href = '/auth/logout';
	});

	return null;
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```tsx
import { Show } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export function TokenPanel() {
	const ctx = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await ctx.refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await ctx.revoke();
	}

	// idTokenClaims/accessToken/refreshToken are accessors - call them to read the current value;
	// they update automatically whenever the SDK's session changes
	return (
		<Show when={!ctx.loading()}>
			<div>
				<button onClick={onRefresh}>Refresh</button>
				<button onClick={onRevoke}>Revoke</button>
				<pre>{JSON.stringify({ idTokenClaims: ctx.idTokenClaims(), accessToken: ctx.accessToken(), refreshToken: ctx.refreshToken() }, null, 2)}</pre>
			</div>
		</Show>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the middleware redirect back:

```tsx
export function TokenPanel() {
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		globalThis.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		globalThis.location.href = '/auth/revoke';
	}

	return (
		<div>
			<button onClick={onRefresh}>Refresh</button>
			<button onClick={onRevoke}>Revoke</button>
		</div>
	);
}
```

---

### Hooks API

#### useStrivacity

The main hook for accessing the SDK instance and reactive session state.

```ts
import { useStrivacity } from '@strivacity/sdk-solid/client';
import type { RedirectFlow } from '@strivacity/sdk-solid/client';

const ctx = useStrivacity<RedirectFlow>();
```

##### Returns

```ts
{
	// SDK instance (access any SDK method)
	readonly sdk: RedirectFlow | PopupFlow | EmbeddedFlow | NativeFlow;

	// Reactive state (accessors - call them, e.g. `ctx.loading()`; the component re-renders when they change)
	readonly loading: Accessor<boolean>; // True during initialization
	readonly language: Accessor<string>; // Current BCP 47 language code
	readonly isAuthenticated: Accessor<boolean>; // True if user has valid session
	readonly idTokenClaims: Accessor<IdTokenClaims | null>; // Decoded ID token claims
	readonly accessToken: Accessor<string | null>; // Current access token
	readonly refreshToken: Accessor<string | null>; // Current refresh token
	readonly accessTokenExpired: Accessor<boolean>; // True once the access token has expired
	readonly accessTokenExpirationDate: Accessor<number | null>; // Access token expiration timestamp

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

Hook for managing native login flow state. Only available in `native` mode. If you split widget rendering into sub-components, provide the returned value to them via the login context so they can read it through `useNativeLoginContext()`.

```ts
import { useNativeLogin } from '@strivacity/sdk-solid/client';
import type { NativeParams } from '@strivacity/sdk-solid/client';

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
	// Reactive state (accessors - call them, e.g. `ctx.loading()`; consumers re-render when they change)
	loading: Accessor<boolean>; // True while fetching next screen
	state: Accessor<Partial<NativeFlowState>>; // Current flow state (screen, forms, layout, etc.)
	forms: Accessor<Record<string, Record<string, unknown>>>; // Form data by form ID
	messages: Accessor<Record<string, Record<string, NativeFlowMessage>>>; // Validation messages

	// Methods
	submitForm(formId: string, customBody?: Record<string, unknown>): Promise<void>; // Submit a form and advance to next screen
	setFormValue(formId: string, widgetId: string, value: unknown): void; // Update a single field value before submission
	setMessage(formId: string, widgetId: string, value: NativeFlowMessage): void; // Set a validation/info message on a widget
	triggerFallback(message?: string): void; // Manually trigger fallback to hosted journey
	triggerClose(): void; // Signal that the login flow was closed by the user
}
```

#### withAuthGuard (client)

Higher-order component that guards a component with authentication. Waits for the SDK to finish loading, checks the session, and redirects to the login route if the user is not authenticated. This is the only route-guard mechanism this SDK ships - see [Route guards](#route-guards) below.

```tsx
import { withAuthGuard } from '@strivacity/sdk-solid/client';

export default withAuthGuard(
	function Profile() {
		return <section>Protected content</section>;
	},
	{ loginUri: '/login' },
);
```

##### Options

```ts
{
	loginUri?: string; // URI to redirect to if the user is not authenticated (default: '/login')
	onLoading?: () => JSX.Element | null; // Optional render function shown while loading/checking authentication
}
```

---

## Server SDK

This is the same backend-for-frontend ([BFF](../../README.md#bff)) server implementation as the [core Server SDK](../sdk-core/README.md#server-sdk), pre-wired for `@solidjs/vite-plugin`'s "start" mode: `createServerSDK` provides a `FetchMiddleware`-based `ServerAdapter` and a default encrypted-cookie storage keyed off the ambient `RequestEvent`.

### Setup

```ts
// src/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-solid/server';
import { sdkOptions } from '../options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // required unless you provide a custom `storage`
	postLoginRedirectUri: '/profile',
});
```

Mount the middleware once - see [Quick start](#quick-start) for the full `vite.config.ts` wiring:

```ts
// src/middleware.ts
import type { FetchMiddleware } from '@solidjs/web';
import { sdk } from './server/strivacity';

const middleware: FetchMiddleware = (request, next) => sdk.middleware(request, next);

export default middleware;
```

### Accessing the session server-side

Call `getSession()` from a `"use server"` function to read the current session without going through the client SDK - see [Quick start](#quick-start) for the full `createMemo`/`<Loading>` wiring pattern that carries the result into client hydration:

```ts
// src/server/session.ts
import type { SessionData } from '@strivacity/sdk-solid/client';
import { sdk } from './strivacity';

export async function getSession(): Promise<SessionData | null> {
	'use server';

	return await sdk.getSession();
}
```

Every Server SDK method accepts an optional `event?: RequestEvent` as its last argument, defaulting to the ambient `getRequestEvent()` when omitted - pass one explicitly if you already have it (e.g. inside the middleware itself):

```ts
import { getRequestEvent } from '@solidjs/web';
import { sdk } from './strivacity';

const session = await sdk.getSession(getRequestEvent());
```

<a id="server-storages"></a>
### Storages

By default the Server SDK stores tokens encrypted in http-only cookies and login state in a global in-memory `Map`. Provide `storage`/`stateStorage` to use something else.

#### Built-in session storages

- **`createEncryptedCookieStorage(secret, options?)`** - default storage that keeps the session encrypted in an http-only cookie.
- **`createSessionIdCookieStorage(storage, options?)`** - puts only a small, random session-id cookie on the client and keeps the actual session payload in the `storage` you provide. This supports back-channel logout out of the box.

```ts
// src/server/storage.ts
import { createSessionIdCookieStorage, createServerMemoryStorage } from '@strivacity/sdk-solid/server/storages';

export const sessionStorage = createSessionIdCookieStorage(
	createServerMemoryStorage(),
	{
		// maxAge: 30 * 24 * 60 * 60 // Without maxAge this is a browser-session cookie that gets cleared when the browser closes
	}
);
```

```ts
// src/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-solid/server';
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
// src/server/storage.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import type { SolidServerStorage, SDKStorage } from '@strivacity/sdk-solid/server';

const unstorageInstance = createStorage({ driver: redisDriver({ url: process.env.REDIS_URL }) });

// Custom session storage for tokens
export const sessionStorage: SolidServerStorage = {
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
// src/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-solid/server';
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

OIDC back-channel logout lets the authorization server terminate sessions server-to-server, without involving the browser. When the IDP sends a logout event (e.g. an admin terminates a session, or the user logs out from a different device), it POSTs a signed `logout_token` JWT to `/auth/backchannel-logout` - already wired up by the middleware from [Setup](#setup) - which routes it to `sdk.handleBackChannelLogout(event)`.

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

	// Route handlers - each returns a Response; `handler` dispatches to the one matching the request path
	handleLogin(event?): Promise<Response>;
	handleRegister(event?): Promise<Response>;
	handleCallback(event?): Promise<Response>;
	handleRefresh(event?): Promise<Response>;
	handleRevoke(event?): Promise<Response>;
	handleEntry(event?): Promise<Response>;
	handleLogout(event?): Promise<Response>;
	handleBackChannelLogout(event?): Promise<Response>;

	// Solid-specific
	middleware: FetchMiddleware; // serves the auth routes, falls through to `next(request)` otherwise; see Setup
}
```

### Server configuration reference

The Server SDK accepts the same configuration as the client SDK (see [Configuration reference](#configuration-reference)), plus:

| Option | Type | Required | Default | Description |
| ------ | ---- | -------- | ------- | ----------- |
| `secret` | `string` | Only if using default storage | - | Encryption key (32+ random characters) for the http-only cookie session storage |
| `storage` | `SolidServerStorage` | No | Encrypted cookie storage | Custom session storage; see [Storages](#server-storages) |
| `stateStorage` | `SDKStorage` | No | In-memory `Map` | Custom OAuth2 state storage |
| `authUrlPrefix` | `string` | No | `'/auth'` | URL prefix matched by `middleware` |
| `loginUri` | `string` | No | `'/login'` | Route `withAuthGuard` (client) redirects to when there's no session |
| `postLoginRedirectUri` | `string` | No | - | Default redirect after login when no `?returnTo=` is given |
| `postLogoutRedirectUri` | `string` | No | - | Default redirect after logout |
| `cookieMaxAge` | `number` | No | `2592000` (30 days) | Max age of the session cookie in seconds |

---

### Route guards

- **Client-side**: wrap a component with [`withAuthGuard`](#withauthguard-client) from `@strivacity/sdk-solid/client` - see [above](#withauthguard-client).

---

## Shared features

The Solid SDK is built on top of the core SDK and supports all its features, on both the client and server:

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

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
