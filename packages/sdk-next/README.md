# @strivacity/sdk-next

Next.js SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Next.js application. Ships with a client SDK and a backend-for-frontend ([BFF](../../README.md#bff)) Server SDK that runs entirely inside your Next.js app via Route Handlers or API Routes - no separate backend required.

Built on top of [@strivacity/sdk-core](../sdk-core) - see the [core SDK documentation](../sdk-core/README.md) for detailed information about authentication flows, configuration options, and advanced features.

**See also:**
- [Full Documentation](https://docs.strivacity.com/reference/overview) - Complete guide for all authentication modes
- [Example App](../../apps/next) - Working Next.js example covering both client-managed and server-managed sessions
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
  - [withAuthGuard](#withauthguard)
  - [withApiAuthRequired](#withapiauthrequired)
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

- Next.js 15+ (App Router or Pages Router)
- React 18+
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-next
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
// lib/auth/options.ts
import type { SDKInitConfig } from '@strivacity/sdk-next/client';

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

Only needed for server-managed sessions - skip this step (and step 3's catch-all route) if you're using client-managed sessions.

```ts
// lib/auth/server.ts
import { createServerSDK } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // http-only cookie encryption key (random 32+ characters)
	postLoginRedirectUri: '/profile',
});
```

### 3. Mount the catch-all route

A single Route Handler wires up every auth route automatically - `sdk.handler` inspects the request path and dispatches to the matching internal handler:

```ts
// app/auth/[...strivacity]/route.ts
import { sdk } from '../../../lib/auth/server';

export const GET = sdk.handler;
export const POST = sdk.handler;
export const PUT = sdk.handler;
export const PATCH = sdk.handler;
export const DELETE = sdk.handler;
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

> The `/auth` prefix and route names come from `authUrlPrefix` - see [Server configuration reference](#server-configuration-reference).

### 4. Wrap your app with the client provider

```tsx
// lib/auth/provider.tsx
'use client';

import type { ReactNode } from 'react';
import type { SessionData } from '@strivacity/sdk-next/client';
import { StyAuthProvider } from '@strivacity/sdk-next/client';
import { sdkOptions } from './options';

export function AuthProvider({ session, children }: { session?: SessionData | null; children: ReactNode }) {
	return (
		<StyAuthProvider options={{ ...sdkOptions }} session={session}>
			{children}
		</StyAuthProvider>
	);
}
```

For client-managed sessions, omit the `session` prop - the client SDK loads and manages the session itself:

```tsx
// app/layout.tsx
import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth/provider';

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en-US">
			<body>
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
```

For server-managed sessions, fetch the session once in your root layout (a Server Component) via the Server SDK's `getSession()` and pass it down:

```tsx
// app/layout.tsx
import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth/provider';
import { sdk } from '../lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
	const session = await sdk.getSession();

	return (
		<html lang="en-US">
			<body>
				<AuthProvider session={session}>{children}</AuthProvider>
			</body>
		</html>
	);
}
```

---

## Client SDK

The client SDK is [@strivacity/sdk-react](../sdk-react) re-exported under `@strivacity/sdk-next/client` - every hook, component, and type documented in the [React SDK README](../sdk-react/README.md) works exactly the same way here, just imported from `@strivacity/sdk-next/client` instead of `@strivacity/sdk-react`. Mark components that use hooks with `'use client'`; pages/layouts that only compose client components can remain Server Components (as shown for `app/layout.tsx` in [Quick start](#quick-start)).

### Authentication modes

#### redirect mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The current browser tab navigates to the Strivacity-hosted login page and back to the configured `redirectUri` after authentication.

##### Login

**Client-managed sessions**:

Call this to start the login flow. It redirects the user to the Strivacity login page in the current browser tab, where they authenticate.

```tsx
// app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';
import type { RedirectFlow } from '@strivacity/sdk-next/client';

export default function LoginPage() {
	const { loading, login } = useStrivacity<RedirectFlow>();

	useEffect(() => {
		if (loading) {
			return;
		}

		void login({
			// Optional parameters
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
		});
	}, [loading, login]);

	return (
		<section>
			<h1>Redirecting to login...</h1>
		</section>
	);
}
```

**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/login` - the Server SDK builds the authorization request and redirects to the IDP:

```tsx
// app/login/page.tsx
import { redirect } from 'next/navigation';

export default function LoginPage() {
	redirect('/auth/login');
}
```

##### Handle the callback

**Client-managed sessions**:

Call this on your redirect URI page after the IDP sends the user back. It parses the query parameters from the callback URL, verifies the state matches what was stored during login (CSRF protection), exchanges the authorization code for tokens using PKCE, validates the ID token, and stores the session in the [configured storage](../sdk-core/README.md#storages).

```tsx
// app/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function CallbackPage() {
	const { loading, handleCallback } = useStrivacity();
	const router = useRouter();
	const searchParams = new URLSearchParams(window.location.search);

	useEffect(() => {
		if (loading) {
			return;
		}

		if (searchParams.get('error')) {
			router.replace(`/error?${searchParams.toString()}`);
			return;
		}

		handleCallback()
			.then(() => router.push('/profile'))
			.catch((error) => router.push(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading]);

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
// app/callback/page.tsx
import { redirect } from 'next/navigation';

export default async function CallbackPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
	const params = new URLSearchParams(await searchParams);
	redirect(`/auth/callback?${params.toString()}`);
}
```

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```tsx
// app/register/page.tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';
import type { RedirectFlow } from '@strivacity/sdk-next/client';

export default function RegisterPage() {
	const { loading, register } = useStrivacity<RedirectFlow>();

	useEffect(() => {
		if (loading) {
			return;
		}

		void register({
			loginHint: 'user@example.com',
		});
	}, [loading, register]);

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
// app/register/page.tsx
import { redirect } from 'next/navigation';

export default function RegisterPage() {
	redirect('/auth/register');
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// app/logout/page.tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function LogoutPage() {
	const { loading, logout } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		void logout();
	}, [loading, logout]);

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```tsx
// app/logout/page.tsx
import { redirect } from 'next/navigation';

export default function LogoutPage() {
	redirect('/auth/logout');
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next/client';

export function TokenPanel() {
	const { loading, idTokenClaims, accessToken, refreshToken, refresh, revoke } = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await revoke();
	}

	if (loading) {
		return null;
	}

	// idTokenClaims, accessToken, and refreshToken are plain values from context -
	// they update automatically whenever the SDK's session changes
	return (
		<div>
			<button onClick={onRefresh}>Refresh</button>
			<button onClick={onRevoke}>Revoke</button>
			<pre>{JSON.stringify({ idTokenClaims, accessToken, refreshToken }, null, 2)}</pre>
		</div>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the catch-all route, then let it redirect back:

```tsx
'use client';

export function TokenPanel() {
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		window.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		window.location.href = '/auth/revoke';
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
// app/login/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';
import type { PopupFlow } from '@strivacity/sdk-next/client';

export default function LoginPage() {
	const { loading, login } = useStrivacity<PopupFlow>();
	const router = useRouter();
	const startedRef = useRef(false);

	useEffect(() => {
		if (loading || startedRef.current) {
			return;
		}

		// Prevent multiple calls (React StrictMode)
		startedRef.current = true;

		login({
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
			.then(() => router.push('/profile'))
			.catch((error) => router.push(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading, login, router]);

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

The popup resolves automatically - no callback page is needed. Token exchange happens inside the popup and the result is posted back to the opener window.

**Server-managed sessions**:

Same as client managed - the popup's internal callback request is also transparently proxied through `/auth/callback`, and the result is posted back to the opener window exactly the same way.

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```tsx
// app/register/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';
import type { PopupFlow } from '@strivacity/sdk-next/client';

export default function RegisterPage() {
	const { loading, register } = useStrivacity<PopupFlow>();
	const router = useRouter();
	const startedRef = useRef(false);

	useEffect(() => {
		if (loading || startedRef.current) {
			return;
		}

		// Prevent multiple calls (React StrictMode)
		startedRef.current = true;

		register({
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
			.then(() => router.push('/profile'))
			.catch((error) => router.push(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading, register, router]);

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
// app/logout/page.tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function LogoutPage() {
	const { loading, logout } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		void logout();
	}, [loading, logout]);

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```tsx
// app/logout/page.tsx
import { redirect } from 'next/navigation';

export default function LogoutPage() {
	redirect('/auth/logout');
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next/client';

export function TokenPanel() {
	const { loading, idTokenClaims, accessToken, refreshToken, refresh, revoke } = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await revoke();
	}

	if (loading) {
		return null;
	}

	// idTokenClaims, accessToken, and refreshToken are plain values from context -
	// they update automatically whenever the SDK's session changes
	return (
		<div>
			<button onClick={onRefresh}>Refresh</button>
			<button onClick={onRevoke}>Revoke</button>
			<pre>{JSON.stringify({ idTokenClaims, accessToken, refreshToken }, null, 2)}</pre>
		</div>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the catch-all route, then let it redirect back:

```tsx
'use client';

export function TokenPanel() {
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		window.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		window.location.href = '/auth/revoke';
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

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your Strivacity tenant cluster once, on the login page:

##### Login / Register

**Client-managed sessions**:

```tsx
// app/login/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity, injectScript } from '@strivacity/sdk-next/client';
import type { LoginComponent } from '@strivacity/sdk-next/client/types';

export default function LoginPage() {
	const router = useRouter();
	const { sdk } = useStrivacity();
	const searchParams = new URLSearchParams(window.location.search);

	// Optional: Resume a session started from an entry URL (e.g., password reset)
	const sessionId = searchParams.get('session_id');
	const shortAppId = searchParams.get('short_app_id');
	const lang = searchParams.get('language') ?? navigator.language;
	const loginRef = useRef<LoginComponent>(null);

	useEffect(() => {
		// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
		// custom element definitions from the auth server
		injectScript('sty-components', `${sdk.options.issuer}/assets/components/bundle.js`);
	}, [sdk]);

	useEffect(() => {
		const element = loginRef.current;

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
		element.sessionId = sessionId;
		element.shortAppId = shortAppId;
		element.lang = lang;

		const onLogin = () => router.push('/profile');
		const onClose = () => window.location.reload();
		const onError = (event: Event) => router.push(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('close', onClose);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('close', onClose);
			element.removeEventListener('error', onError);
		};
	}, [router, sessionId, shortAppId, lang]);

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={loginRef}></sty-login>
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
// app/login/page.tsx
'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { LoginComponent } from '@strivacity/sdk-next/client/types';

export function LazyLogin() {
	const router = useRouter();
	const loginRef = useRef<LoginComponent>(null);

	async function onStartClick() {
		await loginRef.current?.start({
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
			<sty-login ref={loginRef} lazy onLogin={() => router.push('/profile')}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

You can also set params via the `params` property before calling `start()`:

```tsx
// app/login/page.tsx
'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { LoginComponent } from '@strivacity/sdk-next/client/types';

export function LazyLogin() {
	const router = useRouter();
	const loginRef = useRef<LoginComponent>(null);

	async function onStartClick() {
		if (!loginRef.current) {
			return;
		}

		loginRef.current.params = {
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			language: 'en-US', // set the UI language (BCP 47 language tag)
			prompt: 'login', // use 'create' to open the registration flow instead
		};
		await loginRef.current.start();
	}

	return (
		<>
			<sty-login ref={loginRef} lazy></sty-login>
			<button onClick={onStartClick}>Start Login</button>
		</>
	);
}
```

##### Login events

The `<sty-login>` element dispatches `login`, `close`, and `error` custom events. Attach listeners on the element ref inside `useEffect`:

```tsx
// app/login/page.tsx
'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { LoginComponent } from '@strivacity/sdk-next/client/types';

export function LazyLogin() {
	const router = useRouter();
	const loginRef = useRef<LoginComponent>(null);

	useEffect(() => {
		const element = loginRef.current;

		if (!element) {
			return;
		}

		const onLogin = () => {
			// User authenticated - navigate to a protected page
			navigate('/profile');
		};
		const onClose = () => {
			// User cancelled or closed the login flow
			window.location.reload();
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

##### Notification events

The components dispatch `notification` events on the `document` that the `<sty-notifications>` component automatically displays. If you don't want to use `<sty-notifications>`, you can listen to these events and handle them yourself:

```tsx
'use client';

import { useEffect } from 'react';

export function CustomNotifications() {
	useEffect(() => {
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
	}, []);

	return null;
}
```

##### Dynamic language switching

The `<sty-language-selector>` component provides a built-in UI for language switching. If you don't want to use it, you can change the UI language dynamically by updating the `lang` property on the `<sty-login>` component:

```tsx
'use client';

import { useRef, useState } from 'react';

export function LanguageSwitcher() {
	const loginRef = useRef<HTMLElement & { lang: string }>(null);
	const [currentLang, setCurrentLang] = useState('en-US');

	function changeLanguage(lang: string) {
		setCurrentLang(lang);

		if (loginRef.current) {
			loginRef.current.lang = lang;
		}
	}

	return (
		<section>
			<div>
				<button onClick={() => changeLanguage('en-US')}>English</button>
				<button onClick={() => changeLanguage('fr-FR')}>Français</button>
				<button onClick={() => changeLanguage('de-DE')}>Deutsch</button>
			</div>
			<sty-login ref={loginRef} lang={currentLang}></sty-login>
		</section>
	);
}
```

##### Handle the callback

**Client-managed sessions**:

No separate callback page is needed. The `<sty-login>` component handles the entire authentication flow automatically, including token exchange, and dispatches a `login` event when authentication completes successfully.

**Server-managed sessions**:

Same as client managed - the component's internal callback request is also transparently proxied through `/auth/callback`, with no separate page needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing page to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login page**

Forward the parameters as query params to your login page:

```tsx
// app/entry/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';
import type { EmbeddedFlow } from '@strivacity/sdk-next/client';

export default function EntryPage() {
	const { loading, entry } = useStrivacity<EmbeddedFlow>();
	const router = useRouter();

	useEffect(() => {
		if (loading) {
			return;
		}

		entry()
			.then((data) => {
				// Redirect to login page with flow parameters
				const params = new URLSearchParams({
					session_id: data.session_id,
					short_app_id: data.short_app_id,
					language: data.language,
				});
				window.location.href = `/login?${params}`;
			})
			.catch((error) => router.push(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading, entry, router]);

	return (
		<section>
			<h1>Loading...</h1>
		</section>
	);
}
```

Then on your login page, read the parameters and pass them to `<sty-login>`:

```tsx
// app/login/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { LoginComponent } from '@strivacity/sdk-next/client/types';

export default function LoginPage() {
	const router = useRouter();
	const searchParams = new URLSearchParams(window.location.search);

	// Read parameters from URL
	const sessionId = searchParams.get('session_id');
	const shortAppId = searchParams.get('short_app_id');
	const language = searchParams.get('language');
	const loginRef = useRef<LoginComponent>(null);

	useEffect(() => {
		const element = loginRef.current;

		if (!element) {
			return;
		}

		element.sessionId = sessionId;
		element.shortAppId = shortAppId;
		element.lang = language;

		const onLogin = () => router.push('/profile');
		const onError = (event: Event) => router.push(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('error', onError);
		};
	}, [router, sessionId, shortAppId, language]);

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={loginRef}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

**Option 2: Render login on the entry page**

Pass the parameters directly to `<sty-login>` on the same page:

```tsx
// app/entry/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';
import type { LoginComponent } from '@strivacity/sdk-next/client/types';
import type { EmbeddedFlow } from '@strivacity/sdk-next/client';

export default function EntryPage() {
	const { loading, entry } = useStrivacity<EmbeddedFlow>();
	const router = useRouter();
	const loginRef = useRef<LoginComponent>(null);

	const [sessionId, setSessionId] = useState<string | null>(null);
	const [shortAppId, setShortAppId] = useState<string | null>(null);
	const [language, setLanguage] = useState<string | null>(null);

	useEffect(() => {
		if (loading) {
			return;
		}

		entry()
			.then((data) => {
				// Set state for sty-login component
				setSessionId(data.session_id);
				setShortAppId(data.short_app_id);
				setLanguage(data.language);
			})
			.catch((error) => router.push(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading, entry, router]);

	useEffect(() => {
		const element = loginRef.current;

		if (!element || !sessionId) {
			return;
		}

		element.sessionId = sessionId;
		element.shortAppId = shortAppId;
		element.lang = language;

		const onLogin = () => router.push('/profile');
		const onError = (event: Event) => router.push(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('error', onError);
		};
	}, [router, sessionId, shortAppId, language]);

	if (!sessionId) {
		return (
			<section>
				<h1>Loading...</h1>
			</section>
		);
	}

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={loginRef}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// app/logout/page.tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function LogoutPage() {
	const { loading, logout } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		void logout();
	}, [loading, logout]);

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```tsx
// app/logout/page.tsx
import { redirect } from 'next/navigation';

export default function LogoutPage() {
	redirect('/auth/logout');
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next/client';

export function TokenPanel() {
	const { loading, idTokenClaims, accessToken, refreshToken, refresh, revoke } = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await revoke();
	}

	if (loading) {
		return null;
	}

	// idTokenClaims, accessToken, and refreshToken are plain values from context -
	// they update automatically whenever the SDK's session changes
	return (
		<div>
			<button onClick={onRefresh}>Refresh</button>
			<button onClick={onRevoke}>Revoke</button>
			<pre>{JSON.stringify({ idTokenClaims, accessToken, refreshToken }, null, 2)}</pre>
		</div>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the catch-all route, then let it redirect back:

```tsx
'use client';

export function TokenPanel() {
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		window.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		window.location.href = '/auth/revoke';
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

> The example below shows a simplified custom implementation. For a complete native renderer with all widget types, see the [example app](../../apps/next/components/auth/native/NativeLogin.tsx).

##### Login / Register

**Client-managed sessions**:

```tsx
// app/login/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useNativeLogin } from '@strivacity/sdk-next/client';

export default function LoginPage() {
	const router = useRouter();
	const searchParams = new URLSearchParams(window.location.search);

	const { state, forms, messages, loading, submitForm, setFormValue } = useNativeLogin({
		params: {
			prompt: 'login', // use 'create' to open the registration flow instead
			language: 'en-US', // set the UI language (BCP 47 language tag)
			sdk: 'web-minimal', // rendering mode: 'web-minimal' for simplified rendering, 'web' (default) for full rendering hints and branding
			sessionId: searchParams.get('session_id'), // pass a session ID to resume an existing flow
		},
		onLogin: async () => {
			router.push('/profile');
		},
		onClose: () => {
			window.location.reload();
		},
		onError: async (error) => {
			router.push(`/error?message=${encodeURIComponent(error.message)}`);
		},
		onFallback: (error) => {
			// Fallback to hosted journey if native widget not supported
			window.location.href = error.url.toString();
		},
		onGlobalMessage: (message) => {
			alert(message.text);
		},
	});

	if (loading || !state.screen) {
		return (
			<section>
				<h1>Loading...</h1>
			</section>
		);
	}

	if (state.screen === 'identifier') {
		return (
			<section>
				<h2>Sign In</h2>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						await submitForm('identifier');
					}}
				>
					<input
						type="text"
						placeholder="Email"
						value={(forms['identifier']?.identifier as string) ?? ''}
						onChange={(event) => setFormValue('identifier', 'identifier', event.target.value)}
					/>
					{messages['identifier']?.identifier && <div className="error">{messages['identifier'].identifier.text}</div>}
					<button type="submit">Continue</button>
				</form>
			</section>
		);
	}

	if (state.screen === 'password') {
		return (
			<section>
				<h2>Enter Password</h2>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						await submitForm('password');
					}}
				>
					<input
						type="password"
						placeholder="Password"
						value={(forms['password']?.password as string) ?? ''}
						onChange={(event) => setFormValue('password', 'password', event.target.value)}
					/>
					{messages['password']?.password && <div className="error">{messages['password'].password.text}</div>}
					<button type="submit">Sign In</button>
				</form>
			</section>
		);
	}

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - `useNativeLogin`'s internal requests are transparently proxied through your server instead of going straight to the IDP.

##### Handle the callback

**Client-managed sessions**:

No separate callback page is needed. Once `state.finalizeUrl` is set, `submitForm()` automatically finalizes the session internally to exchange the authorization code for tokens and store it.

**Server-managed sessions**:

Same as client managed - finalizing the session also transparently proxies through your server, with no separate page needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing page to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login page**

```tsx
// app/entry/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';
import type { NativeFlow } from '@strivacity/sdk-next/client';

export default function EntryPage() {
	const { loading, entry } = useStrivacity<NativeFlow>();
	const router = useRouter();

	useEffect(() => {
		if (loading) {
			return;
		}

		entry()
			.then((data) => {
				const params = new URLSearchParams({
					session_id: data.session_id,
					short_app_id: data.short_app_id,
					language: data.language,
				});
				window.location.href = `/login?${params}`;
			})
			.catch((error) => router.push(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading, entry, router]);

	return (
		<section>
			<h1>Loading...</h1>
		</section>
	);
}
```

Then on your login page, read query parameters from the URL and pass it to `useNativeLogin` to resume the flow, exactly as shown in the Login / Register example above:

```tsx
// app/login/page.tsx
'use client';

import { useNativeLogin } from '@strivacity/sdk-next/client';

export default function LoginPage() {
	const searchParams = new URLSearchParams(window.location.search);

	const { state, loading, forms, messages, submitForm, setFormValue } = useNativeLogin({
		params: {
			sessionId: searchParams.get('session_id'),
			language: searchParams.get('language'),
		},
		onLogin: async () => {
			window.location.href = '/profile';
		},
	});

	// ...render based on `state.screen` as shown in the Login / Register example above
}
```

**Option 2: Render login on the entry page**

Call `useNativeLogin` directly inside `app/entry/page.tsx`, feeding it the `session_id` resolved from `entry()` - no redirect needed:

```tsx
// app/entry/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity, useNativeLogin } from '@strivacity/sdk-next/client';
import type { NativeFlow } from '@strivacity/sdk-next/client';

export default function EntryPage() {
	const { loading: sdkLoading, entry } = useStrivacity<NativeFlow>();
	const router = useRouter();
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [language, setLanguage] = useState<string | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (sdkLoading) {
			return;
		}

		entry()
			.then((data) => {
				setSessionId(data.session_id);
				setLanguage(data.language);
				setReady(true);
			})
			.catch((error) => router.push(`/error?message=${encodeURIComponent(error.message)}`));
	}, [sdkLoading, entry, router]);

	const { state, loading, forms, messages, submitForm, setFormValue } = useNativeLogin({
		params: { sessionId, language },
		onLogin: async () => {
			router.push('/profile');
		},
		onError: async (error) => {
			router.push(`/error?message=${encodeURIComponent(error.message)}`);
		},
	});

	if (!ready || loading || !state.screen) {
		return (
			<section>
				<h1>Loading...</h1>
			</section>
		);
	}

	// ...render based on `state.screen` as shown in the Login / Register example above
	return null;
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// app/logout/page.tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function LogoutPage() {
	const { loading, logout } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		void logout();
	}, [loading, logout]);

	return null;
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```tsx
// app/logout/page.tsx
import { redirect } from 'next/navigation';

export default function LogoutPage() {
	redirect('/auth/logout');
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next/client';

export function TokenPanel() {
	const { loading, idTokenClaims, accessToken, refreshToken, refresh, revoke } = useStrivacity();

	async function onRefresh() {
		// Refresh the access token using the refresh token
		await refresh();
	}

	async function onRevoke() {
		// Revoke all tokens at the authorization server and clear the local session
		await revoke();
	}

	if (loading) {
		return null;
	}

	// idTokenClaims, accessToken, and refreshToken are plain values from context -
	// they update automatically whenever the SDK's session changes
	return (
		<div>
			<button onClick={onRefresh}>Refresh</button>
			<button onClick={onRevoke}>Revoke</button>
			<pre>{JSON.stringify({ idTokenClaims, accessToken, refreshToken }, null, 2)}</pre>
		</div>
	);
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the catch-all route, then let it redirect back:

```tsx
'use client';

export function TokenPanel() {
	function onRefresh() {
		// sdk.refreshSession() runs server-side, then redirects back to returnTo
		window.location.href = '/auth/refresh?returnTo=/profile';
	}

	function onRevoke() {
		// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
		window.location.href = '/auth/revoke';
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

The main hook for accessing the SDK instance and authentication state.

```ts
import { useStrivacity } from '@strivacity/sdk-next/client';
import type { RedirectFlow } from '@strivacity/sdk-next/client';

const ctx = useStrivacity<RedirectFlow>();
```

##### Returns

```ts
{
	// SDK instance (access any SDK method)
	sdk: RedirectFlow | PopupFlow | EmbeddedFlow | NativeFlow;

	// Reactive state (plain values - the component re-renders when they change)
	loading: boolean; // True during initialization
	isAuthenticated: boolean; // True if user has valid session
	idTokenClaims: IdTokenClaims | null; // Decoded ID token claims
	accessToken: string | null; // Current access token
	refreshToken: string | null; // Current refresh token

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

Hook for managing native login flow state. Only available in `native` mode.

```ts
import { useNativeLogin } from '@strivacity/sdk-next/client';
import type { NativeParams } from '@strivacity/sdk-next/client';

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
	// Reactive state (plain values - the component re-renders when they change)
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

#### withAuthGuard (client)

Higher-order component that guards a component with authentication. Waits for the SDK to finish loading, checks the session, and redirects to the login page if the user is not authenticated. Not to be confused with the Server SDK's [`withAuthGuard`](#withauthguard), which guards a page/route server-side.

```tsx
'use client';

import { withAuthGuard } from '@strivacity/sdk-next/client';

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
	onLoading?: () => ReactNode; // Optional render function shown while loading/checking authentication
}
```

---

## Server SDK


This is the same backend-for-frontend ([BFF](../../README.md#bff)) server implementation as the [core Server SDK](../sdk-core/README.md#server-sdk), pre-wired for Next.js: `createServerSDK` provides a Next.js `ServerAdapter`, a default encrypted-cookie storage backed by `next/headers`' `cookies()`.

### Setup

```ts
// lib/auth/server.ts
import { createServerSDK } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';

export const sdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // required unless you provide a custom `storage`
	postLoginRedirectUri: '/profile',
});
```

Works with both routers. Mount the catch-all route once:

```ts
// App Router: app/auth/[...strivacity]/route.ts
import { sdk } from '../../../lib/auth/server';

export const GET = sdk.handler;
export const POST = sdk.handler;
export const PUT = sdk.handler;
export const PATCH = sdk.handler;
export const DELETE = sdk.handler;
```

```ts
// Pages Router: pages/api/auth/[...strivacity].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../../lib/auth/server';
import { toWebRequest, applyResponse } from '../../../lib/auth/adapter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	const response = await sdk.handler(toWebRequest(req));
	await applyResponse(response, res);
}
```

> The Pages Router hands you a Node.js request/response pair rather than a Web `Request`/`Response` - see the core SDK's [Express adapter example](../sdk-core/README.md#server-usage) for `toWebRequest`/`applyResponse` implementations you can adapt.

### Accessing the session server-side

Call `getSession()` from any Server Component, Route Handler, or `getServerSideProps` to read the current session without going through the client SDK:

```tsx
// app/profile/page.tsx (Server Component)
import { redirect } from 'next/navigation';
import { sdk } from '../../lib/auth/server';

export default async function ProfilePage() {
	const session = await sdk.getSession();

	if (!session) {
		redirect('/login');
	}

	return <h1>Hello, {session.claims?.given_name}</h1>;
}
```

### withAuthGuard

Guards a page and injects a `session` prop, redirecting to `options.loginUri` (default `/login`) when there's no active session.

**App Router:**

```tsx
// app/profile/page.tsx
import { sdk } from '../../lib/auth/server';

export default sdk.withAuthGuard(async function ProfilePage({ session }) {
	return <h1>Hello, {session.claims?.given_name}</h1>;
});
```

**Pages Router:**

```tsx
// pages/profile.tsx
import type { SessionData } from '@strivacity/sdk-next/server';
import { sdk } from '../lib/auth/server';

export const getServerSideProps = sdk.withAuthGuard<{ session: SessionData }>();

export default function ProfilePage({ session }: { session: SessionData }) {
	return <h1>Hello, {session.claims?.given_name}</h1>;
}
```

Pass `returnTo` to redirect back to a specific page after login, or (Pages Router only) `getServerSideProps` to run your own data fetching alongside the guard:

```ts
export const getServerSideProps = sdk.withAuthGuard({
	returnTo: '/profile',
	getServerSideProps: async () => ({ props: { extra: 'data' } }),
});
```

### withApiAuthRequired

Guards an API route; responds `401 { error: 'not_authenticated' }` when there's no active session.

**App Router:**

```ts
// app/api/me/route.ts
import { sdk } from '../../../lib/auth/server';

export const GET = sdk.withApiAuthRequired(async (req) => {
	const session = await sdk.getSession(req);
	return Response.json({ claims: session?.claims });
});
```

**Pages Router:**

```ts
// pages/api/me.ts
import { sdk } from '../../lib/auth/server';

export default sdk.withApiAuthRequired(async (req, res) => {
	const session = await sdk.getSession(req);
	res.json({ claims: session?.claims });
});
```

<a id="server-storages"></a>
### Storages

By default the Server SDK stores tokens encrypted in http-only cookies and login state in a global in-memory `Map`. Provide `storage`/`stateStorage` to use something else.

#### Built-in session storages

- **`createEncryptedCookieStorage(secret, options?)`** - default storage that keeps the session encrypted in an http-only cookie.
- **`createSessionIdCookieStorage(storage, options?)`** - puts only a small, random session-id cookie on the client and keeps the actual session payload in the `storage` you provide. This supports back-channel logout out of the box.

```ts
// lib/auth/storage.ts
import { createSessionIdCookieStorage, createServerMemoryStorage } from '@strivacity/sdk-next/server';

export const sessionStorage = createSessionIdCookieStorage(
	createServerMemoryStorage(),
	{
		// maxAge: 30 * 24 * 60 * 60 // Without maxAge this is a browser-session cookie that gets cleared when the browser closes
	},
);
```

```ts
// lib/auth/server.ts
import { createServerSDK } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';
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
// lib/auth/storage.ts
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import type { NextServerStorage, SDKStorage } from '@strivacity/sdk-next/server';

const unstorageInstance = createStorage({ driver: redisDriver({ url: process.env.REDIS_URL }) });

// Custom session storage for tokens
export const sessionStorage: NextServerStorage = {
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
// lib/auth/server.ts
import { createServerSDK } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';
import { sessionStorage, stateStorage } from './storage';

export const sdk = createServerSDK({
	...sdkOptions,
	storage: sessionStorage, // Custom Redis-backed session storage
	stateStorage, // Custom Redis-backed state storage
});
```

> For more details on the storage interfaces, see the core SDK's [Custom storage](../sdk-core/README.md#server-storages) section.

### Back-channel logout

OIDC back-channel logout lets the authorization server terminate sessions server-to-server, without involving the browser. When the IDP sends a logout event (e.g. an admin terminates a session, or the user logs out from a different device), it POSTs a signed `logout_token` JWT to `/auth/backchannel-logout` - already wired up by the catch-all route from [Setup](#setup) - which routes it to `sdk.handleBackChannelLogout(req)`.

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
	getSession(req?): Promise<SessionData | null>; // read the current session
	updateSession(session, req?): Promise<void>; // persist new session data
	refreshSession(req?): Promise<SessionData>; // refresh tokens using the refresh token
	revokeSession(req?): Promise<void>; // revoke tokens and clear the session
	getEntrySession(entryUrl): Promise<Record<string, string>>; // resolve an externally-initiated (embedded/native) entry URL
	completeLogin(params, req?): Promise<SessionData>; // exchange an authorization code for tokens
	logout(postLogoutRedirectUri, req?): Promise<URL>; // clear the session, returns the IDP end-session URL

	// Route handlers - each returns a Response; `handler` dispatches to the one matching the request path
	handleLogin(req): Promise<Response>;
	handleRegister(req): Promise<Response>;
	handleCallback(req): Promise<Response>;
	handleRefresh(req): Promise<Response>;
	handleRevoke(req): Promise<Response>;
	handleEntry(req): Promise<Response>;
	handleLogout(req): Promise<Response>;
	handleBackChannelLogout(req): Promise<Response>;
	handler(req): Promise<Response | null>; // dispatches based on `authUrlPrefix`, or null if no route matched

	// Next.js-specific
	withAuthGuard(...): ...; // see withAuthGuard
	withApiAuthRequired(...): ...; // see withApiAuthRequired
}
```

### Server configuration reference

The Server SDK accepts the same configuration as the client SDK (see [Configuration reference](#configuration-reference)), plus:

| Option | Type | Required | Default | Description |
| ------ | ---- | -------- | ------- | ----------- |
| `secret` | `string` | Only if using default storage | - | Encryption key (32+ random characters) for the http-only cookie session storage |
| `storage` | `NextServerStorage` | No | Encrypted cookie storage | Custom session storage; see [Storages](#server-storages) |
| `stateStorage` | `SDKStorage` | No | In-memory `Map` | Custom OAuth2 state storage |
| `authUrlPrefix` | `string` | No | `'/auth'` | URL prefix matched by `handler`/the catch-all route |
| `loginUri` | `string` | No | `'/login'` | Page `withAuthGuard` redirects to when there's no session |
| `postLoginRedirectUri` | `string` | No | - | Default redirect after login when no `?returnTo=` is given |
| `postLogoutRedirectUri` | `string` | No | - | Default redirect after logout |
| `cookieMaxAge` | `number` | No | `2592000` (30 days) | Max age of the session cookie in seconds |

---

## Route guards

- **Client-side**: wrap a `'use client'` component with `withAuthGuard` from `@strivacity/sdk-next/client` - see [withAuthGuard](#withauthguard-client) above.
- **Server-side**: wrap a page (App Router) or `getServerSideProps` (Pages Router) with `sdk.withAuthGuard` from the Server SDK - see [withAuthGuard](#withauthguard) above.

---

## Shared features

The Next.js SDK is built on top of the core SDK and supports all its features, on both the client and server:

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

v4 replaces the SDK's class-based flow architecture with function-based architecture, and adds a first-class Server SDK for server-managed (BFF) sessions. `StyAuthProvider`, `useStrivacity()`, `useNativeLogin()`, and the built-in `redirect`/`popup`/`embedded`/`native` modes are unchanged - only apps that used `mode: 'custom'` or drove `native` mode through the old `NativeFlowHandler` need to update their code.

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

#### Server-managed sessions ([BFF](../../README.md#bff)) are now built in

In v3, routing authentication through your own backend meant writing a custom flow class like the one above yourself: manually calling `fetch()` against hand-written endpoints, and reimplementing PKCE/state handling, CSRF protection, and server-side token storage on your own.

v4 replaces that with the Server SDK shown in [Quick start](#quick-start) above: add `serverSessionUri` to your shared `sdkOptions`, create the server side with `createServerSDK` from `@strivacity/sdk-next/server`, and export its `handler` from a single catch-all Route Handler - PKCE, state, and session storage are all handled by the Server SDK:

```ts
// lib/auth/server.ts
import { createServerSDK } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';

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

v4 moves `startSession()`, `submitForm()`, and `finalizeSession()` directly onto the flow itself - in `@strivacity/sdk-next` this is wrapped for you by the [`useNativeLogin()`](#usenativelogin) hook:

```ts
import { useNativeLogin } from '@strivacity/sdk-next/client';

// v4
const { state, forms, messages, submitForm } = useNativeLogin({
	params: { sessionId },
});

await submitForm('formId');
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
