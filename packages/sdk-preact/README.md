# @strivacity/sdk-preact

Preact SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Preact application with hooks.

Built on top of [@strivacity/sdk-core](../sdk-core) - see the [core SDK documentation](../sdk-core/README.md) for detailed information about authentication flows, configuration options, and advanced features.

**See also:**
- [Full Documentation](https://docs.strivacity.com/reference/overview) - Complete guide for all authentication modes
- [Example App](../../apps/preact) - Working Preact example covering all four login modes
- [Core SDK](../sdk-core/README.md) - Framework-agnostic SDK documentation

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Quick start](#quick-start)
- [Authentication modes](#authentication-modes)
  - [redirect mode](#redirect-mode)
  - [popup mode](#popup-mode)
  - [embedded mode](#embedded-mode)
  - [native mode](#native-mode)
- [Hooks API](#hooks-api)
  - [useStrivacity](#usestrivacity)
  - [useNativeLogin](#usenativelogin)
  - [withAuthGuard](#withauthguard)
- [Route guards](#route-guards)
- [Token management](#token-management)
- [Shared features](#shared-features)
- [Configuration reference](#configuration-reference)
- [Migration guide](#migration-guide)
- [Vulnerability Reporting](#vulnerability-reporting)
- [License](#license)
- [Contributing](#contributing)

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

The SDK supports **four authentication modes**:

| Mode       | Login UI                                 | Best for                                     |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `redirect` | Strivacity hosted page                   | Standard web apps                            |
| `popup`    | Strivacity hosted page in a popup        | SPAs that must stay on the current page      |
| `embedded` | Strivacity web components in your page   | Branded login inside your own layout         |
| `native`   | Your own components driven by flow state | Full UI control, step-by-step form rendering |

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where the login UI lives and how the flow state is consumed.

---

## Quick start

### 1. Wrap your app with the provider

`StyAuthProvider` is a Preact context provider - wrap it around your root component once. It initializes the SDK and provides the auth context to every component in the tree via Preact context.

```tsx
// main.tsx
import { render } from 'preact';
import { StyAuthProvider } from '@strivacity/sdk-preact';
import { App } from './App';

render(
	<StyAuthProvider
		options={{
			mode: 'redirect', // authentication mode
			issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
			clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
			redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
			scopes: ['openid', 'profile', 'email'], // requested user permissions/data
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

export function Header() {
	const { loading, isAuthenticated, idTokenClaims, login, logout } = useStrivacity();

	if (loading) {
		return null;
	}

	return (
		<div>
			{isAuthenticated ? (
				<>
					<span>Hello, {idTokenClaims?.given_name}</span>
					<button onClick={() => logout()}>Log out</button>
				</>
			) : (
				<button onClick={() => login()}>Log in</button>
			)}
		</div>
	);
}
```

---

## Authentication modes

### redirect mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The current browser tab navigates to the Strivacity-hosted login page and back to the configured `redirectUri` after authentication.

```tsx
// main.tsx
import { render } from 'preact';
import { StyAuthProvider } from '@strivacity/sdk-preact';
import { App } from './App';

render(
	<StyAuthProvider
		options={{
			mode: 'redirect', // authentication mode
			issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
			clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
			redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
			scopes: ['openid', 'profile', 'email'], // requested user permissions/data
		}}
	>
		<App />
	</StyAuthProvider>,
	document.getElementById('app')!,
);
```

#### Login

Call this to start the login flow. It redirects the user to the Strivacity login page in current browser tab, where they authenticate.

```tsx
// pages/Login.tsx
import { useEffect } from 'preact/hooks';
import { useStrivacity } from '@strivacity/sdk-preact';
import type { RedirectFlow } from '@strivacity/sdk-preact';

export default function Login() {
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
			locationMethod: 'assign', // window.location method: 'assign' adds to browser history, 'replace' doesn't (default: 'assign')
			targetWindow: 'self', // 'self' redirects current window, 'top' redirects top-level window (default: 'self')
		});
	}, [loading, login]);

	return (
		<section>
			<h1>Redirecting to login...</h1>
		</section>
	);
}
```

#### Handle the callback

Call this on your redirect URI page after the IDP sends the user back. It parses the query parameters from the callback URL, verifies the state matches what was stored during login (CSRF protection), exchanges the authorization code for tokens using PKCE, validates the ID token, and stores the session in the [configured storage](#storages). After that you can redirect to a protected page or render your app.

```tsx
// pages/Callback.tsx
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';

export default function Callback() {
	const { loading, handleCallback } = useStrivacity();
	const searchParams = new URLSearchParams(window.location.search);

	useEffect(() => {
		if (loading) {
			return;
		}

		if (searchParams.get('error')) {
			window.location.href = `/error?${searchParams.toString()}`;
			return;
		}

		handleCallback()
			.then(() => {
				window.location.href = '/profile';
			})
			.catch((error) => {
				window.location.href = `/error?message=${encodeURIComponent(error.message)}`;
			});
	}, [loading]);

	return (
		<section>
			<h1>Logging in...</h1>
		</section>
	);
}
```

> The callback URL is automatically read from `window.location.href` if not provided. You can pass a custom URL as the first parameter: `await sdk.handleCallback(customUrl)`.

#### Registration

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```tsx
// pages/Register.tsx
import { useEffect } from 'preact/hooks';
import { useStrivacity } from '@strivacity/sdk-preact';
import type { RedirectFlow } from '@strivacity/sdk-preact';

export default function Register() {
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

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// pages/Logout.tsx
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';

export default function Logout() {
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

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

#### Token management

Call these methods to manage the session and access token.

```tsx
import { useStrivacity } from '@strivacity/sdk-preact';

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

---

### popup mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The Strivacity login page opens in a separate window or tab. After authentication the opened window or tab closes itself and the parent page receives the session - no full-page navigation required.

```tsx
// main.tsx
import { render } from 'preact';
import { StyAuthProvider } from '@strivacity/sdk-preact';
import { App } from './App';

render(
	<StyAuthProvider
		options={{
			mode: 'popup', // authentication mode
			issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
			clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
			redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
			scopes: ['openid', 'profile', 'email'], // requested user permissions/data
		}}
	>
		<App />
	</StyAuthProvider>,
	document.getElementById('app')!,
);
```

#### Login

Call this to start the login flow. It opens a popup window by default with the Strivacity login page, where the user authenticates. After that the popup closes itself and the session is stored in the [configured storage](#storages).

By default a centered popup window opens. Pass `popupWindowTarget` to change where the window opens, and `popupWindowFeatures` to control its size and position:

```tsx
// pages/Login.tsx
import { useEffect, useRef } from 'preact/hooks';
import { useStrivacity } from '@strivacity/sdk-preact';
import type { PopupFlow } from '@strivacity/sdk-preact';

export default function Login() {
	const { loading, login } = useStrivacity<PopupFlow>();
	const startedRef = useRef(false);

	useEffect(() => {
		if (loading || startedRef.current) {
			return;
		}

		// Prevent multiple calls
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
			.then(() => {
				window.location.href = '/profile';
			})
			.catch((error) => {
				window.location.href = `/error?message=${encodeURIComponent(error.message)}`;
			});
	}, [loading, login]);

	return (
		<section>
			<h1>Opening login popup...</h1>
		</section>
	);
}
```

#### Handle the callback

The popup resolves automatically - no callback page is needed. Token exchange happens inside the popup and the result is posted back to the opener window.

#### Registration

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```tsx
// pages/Register.tsx
import { useEffect, useRef } from 'preact/hooks';
import { useStrivacity } from '@strivacity/sdk-preact';
import type { PopupFlow } from '@strivacity/sdk-preact';

export default function Register() {
	const { loading, register } = useStrivacity<PopupFlow>();
	const startedRef = useRef(false);

	useEffect(() => {
		if (loading || startedRef.current) {
			return;
		}

		// Prevent multiple calls
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
			.then(() => {
				window.location.href = '/profile';
			})
			.catch((error) => {
				window.location.href = `/error?message=${encodeURIComponent(error.message)}`;
			});
	}, [loading, register]);

	return (
		<section>
			<h1>Opening registration popup...</h1>
		</section>
	);
}
```

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// pages/Logout.tsx
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';

export default function Logout() {
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

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

#### Token management

Call these methods to manage the session and access token.

```tsx
import { useStrivacity } from '@strivacity/sdk-preact';

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

---

### embedded mode

> For details on how this mode works, see the [embedded journey documentation](https://docs.strivacity.com/reference/embedded-journey).

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your Strivacity tenant cluster once during application bootstrap, alongside SDK initialization:

```tsx
// main.tsx
import { render } from 'preact';
import { StyAuthProvider, injectScript } from '@strivacity/sdk-preact';
import { App } from './App';

// Load web components bundle
injectScript('sty-components', 'https://<YOUR_TENANT_DOMAIN>/assets/components/bundle.js');

render(
	<StyAuthProvider
		options={{
			mode: 'embedded', // authentication mode
			issuer: 'https://<YOUR_TENANT_DOMAIN>', // OIDC provider URL
			clientId: 'YOUR_CLIENT_ID', // OAuth2 client ID
			redirectUri: 'https://your-app.example.com/callback', // callback URL after authentication
			scopes: ['openid', 'profile', 'email'], // requested user permissions/data
		}}
	>
		<App />
	</StyAuthProvider>,
	document.getElementById('app')!,
);
```

#### Login / Register

In embedded mode `<sty-login>` web component does not take `issuer`, `clientId`, or `redirectUri` as attributes - those come from the SDK configuration above. Place it on your login page together with `sty-notifications` (toast-style system notifications) and `sty-language-selector` (a language switcher for the login flow). Since `<sty-login>` is a plain custom element, its properties (`params`, `sessionId`, `shortAppId`, `lang`) and DOM events are wired up through a ref instead of JSX props:

```tsx
// pages/Login.tsx
import { useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import type { LoginComponent } from '@strivacity/sdk-preact/types';

export default function Login() {
	const searchParams = new URLSearchParams(window.location.search);

	// Optional: Resume a session started from an entry URL (e.g., password reset)
	const sessionId = searchParams.get('session_id');
	const shortAppId = searchParams.get('short_app_id');
	const lang = searchParams.get('language') ?? navigator.language;
	const loginRef = useRef<LoginComponent>(null);

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

		const onLogin = () => route('/profile');
		const onClose = () => window.location.reload();
		const onError = (event: Event) => route(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('close', onClose);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('close', onClose);
			element.removeEventListener('error', onError);
		};
	}, [sessionId, shortAppId, lang]);

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={loginRef}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

##### Controlling when the flow starts

By default the login flow starts automatically as soon as `<sty-login>` connects to the DOM. Add the `lazy` attribute to take manual control, then call `start()` when ready. `start()` accepts an optional params object forwarded to the authorization request, or you can set params via the `params` property before calling it:

```tsx
// pages/Login.tsx
import { useRef } from 'preact/hooks';
import { route } from 'preact-router';
import type { LoginComponent } from '@strivacity/sdk-preact/types';

export default function Login() {
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
			<sty-login ref={loginRef} lazy onLogin={() => route('/profile')}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

You can also set params via the `params` property before calling `start()`:

```tsx
import { useRef } from 'preact/hooks';
import type { LoginComponent } from '@strivacity/sdk-preact/types';

export function LazyLogin() {
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
// pages/Login.tsx
import { useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import type { LoginComponent } from '@strivacity/sdk-preact/types';

export default function Login() {
	const loginRef = useRef<LoginComponent>(null);

	useEffect(() => {
		const element = loginRef.current;

		if (!element) {
			return;
		}

		const onLogin = () => {
			// User authenticated - navigate to a protected page
			route('/profile');
		};
		const onClose = () => {
			// User cancelled or closed the login flow
			window.location.reload();
		};
		const onError = (event: Event) => {
			// A fatal error occurred - the message is available in event.detail
			route(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);
		};

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

##### Notification events

The components dispatch `notification` events on the `document` that the `<sty-notifications>` component automatically displays. If you don't want to use `<sty-notifications>`, you can listen to these events and handle them yourself:

```tsx
import { useEffect } from 'preact/hooks';

export function CustomNotifications() {
	useEffect(() => {
		function onNotification(event: Event) {
			const customEvent = event as CustomEvent;

			if (customEvent.detail.action === 'show') {
				// Add new notification to your custom notification system
				const notification = customEvent.detail.notification;
				console.log('New notification:', notification);
				// Handle the notification display in your own UI
			} else if (customEvent.detail.action === 'clear') {
				// Clear all notifications
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
import { useRef, useState } from 'preact/hooks';

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

#### Handle the callback

No separate callback page is needed. The `<sty-login>` component handles the entire authentication flow automatically, including token exchange, and dispatches a `login` event when authentication completes successfully.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing page to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login page**

Forward the parameters as query params to your login page:

```tsx
// pages/Entry.tsx
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import type { EmbeddedFlow } from '@strivacity/sdk-preact';

export default function Entry() {
	const { loading, entry } = useStrivacity<EmbeddedFlow>();

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
			.catch((error) => route(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading, entry]);

	return (
		<section>
			<h1>Loading...</h1>
		</section>
	);
}
```

Then on your login page, read the parameters and pass them to `<sty-login>`:

```tsx
// pages/Login.tsx
import { useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import type { LoginComponent } from '@strivacity/sdk-preact/types';

export default function Login() {
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

		const onLogin = () => route('/profile');
		const onError = (event: Event) => route(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('error', onError);
		};
	}, [sessionId, shortAppId, language]);

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
// pages/Entry.tsx
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import type { LoginComponent } from '@strivacity/sdk-preact/types';
import type { EmbeddedFlow } from '@strivacity/sdk-preact';

export default function Entry() {
	const { loading, entry } = useStrivacity<EmbeddedFlow>();
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
			.catch((error) => route(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading, entry]);

	useEffect(() => {
		const element = loginRef.current;

		if (!element || !sessionId) {
			return;
		}

		element.sessionId = sessionId;
		element.shortAppId = shortAppId;
		element.lang = language;

		const onLogin = () => route('/profile');
		const onError = (event: Event) => route(`/error?message=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('error', onError);
		};
	}, [sessionId, shortAppId, language]);

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

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// pages/Logout.tsx
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';

export default function Logout() {
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

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

#### Token management

Call these methods to manage the session and access token.

```tsx
import { useStrivacity } from '@strivacity/sdk-preact';

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

---

### native mode

> For details on how this mode works, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey).

You build the entire login UI with your own components. `useNativeLogin()` drives a "headless" auth flow: instead of redirecting to a hosted page, the SDK returns a JSON description of the current screen that you render yourself, submit each form step with `submitForm()`, and repeat until the flow finalizes automatically.

> The example below shows a simplified custom implementation. For a complete native renderer with all widget types, see the [example app](../../apps/preact/src/components/auth/native/NativeLogin.tsx).

#### Login / Register

Create a login page using `useNativeLogin`:

```tsx
// pages/Login.tsx
import { useNativeLogin } from '@strivacity/sdk-preact';

export default function Login() {
	const searchParams = new URLSearchParams(window.location.search);

	const { state, forms, messages, loading, submitForm, setFormValue } = useNativeLogin({
		params: {
			prompt: 'login', // use 'create' to open the registration flow instead
			language: 'en-US', // set the UI language (BCP 47 language tag)
			sdk: 'web-minimal', // rendering mode: 'web-minimal' for simplified rendering (see below), 'web' (default) for full rendering hints and branding
			sessionId: searchParams.get('session_id'), // pass a session ID to resume an existing flow
		},
		onLogin: async () => {
			window.location.href = '/profile';
		},
		onClose: () => {
			window.location.reload();
		},
		onError: async (error) => {
			window.location.href = `/error?message=${encodeURIComponent(error.message)}`;
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

#### Handle the callback

No separate callback page is needed. Once `state.finalizeUrl` is set, `submitForm()` automatically finalizes the session internally to exchange the authorization code for tokens and store it.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing page to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login page**

```tsx
// pages/Entry.tsx
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import type { NativeFlow } from '@strivacity/sdk-preact';

export default function Entry() {
	const { loading, entry } = useStrivacity<NativeFlow>();

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
			.catch((error) => route(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading, entry]);

	return (
		<section>
			<h1>Loading...</h1>
		</section>
	);
}
```

Then on your login page, read query parameters from the URL and pass it to `useNativeLogin` to resume the flow, exactly as shown in the Login / Register example above:

```tsx
// pages/Login.tsx
import { useNativeLogin } from '@strivacity/sdk-preact';

export default function Login() {
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

Call `useNativeLogin` directly inside `Entry.tsx`, feeding it the `session_id` resolved from `entry()` - no redirect needed:

```tsx
// pages/Entry.tsx
import { useStrivacity, useNativeLogin } from '@strivacity/sdk-preact';
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import type { NativeFlow } from '@strivacity/sdk-preact';

export default function Entry() {
	const { loading: sdkLoading, entry } = useStrivacity<NativeFlow>();
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
			.catch((error) => route(`/error?message=${encodeURIComponent(error.message)}`));
	}, [sdkLoading, entry]);

	const { state, loading, forms, messages, submitForm, setFormValue } = useNativeLogin({
		params: { sessionId, language },
		onLogin: async () => {
			route('/profile');
		},
		onError: async (error) => {
			route(`/error?message=${encodeURIComponent(error.message)}`);
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

#### Logout

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```tsx
// pages/Logout.tsx
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';

export default function Logout() {
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

> The `postLogoutRedirectUri` must be configured in your Strivacity application client settings as an allowed post-logout redirect URI. If the URL is invalid or not provided, the user remains on the Strivacity-hosted logged out page.

#### Token management

Call these methods to manage the session and access token.

```tsx
import { useStrivacity } from '@strivacity/sdk-preact';

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

---

## Hooks API

### useStrivacity

The main hook for accessing the SDK instance and authentication state.

```ts
import { useStrivacity } from '@strivacity/sdk-preact';
import type { RedirectFlow } from '@strivacity/sdk-preact';

const ctx = useStrivacity<RedirectFlow>();
```

#### Returns

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

### useNativeLogin

Hook for managing native login flow state. Only available in `native` mode.

```ts
import { useNativeLogin } from '@strivacity/sdk-preact';
import type { NativeParams } from '@strivacity/sdk-preact';

const ctx = useNativeLogin({
	params: { /* login params */ },
	onLogin: (session) => { /* handle login */ },
	onError: (error) => { /* handle error */ },
	// ... other callbacks
});
```

#### Options

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

#### Returns

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

### withAuthGuard

Higher-order component that guards a component with authentication. Waits for the SDK to finish loading, checks the session, and redirects to the login page if the user is not authenticated.

```tsx
import { withAuthGuard } from '@strivacity/sdk-preact';

export default withAuthGuard(
	function Profile() {
		return <section>Protected content</section>;
	},
	{ loginUri: '/login' },
);
```

#### Options

```ts
{
	loginUri?: string; // URI to redirect to if the user is not authenticated (default: '/login')
	onLoading?: () => ComponentChildren; // Optional render function shown while loading/checking authentication
}
```

---

## Route guards

Protect routes that require authentication with the `withAuthGuard` higher-order component. It waits for the SDK to finish loading, verifies the session, and redirects to the login page if the user is not authenticated:

```tsx
// pages/Profile.tsx
import { withAuthGuard, useStrivacity } from '@strivacity/sdk-preact';

export default withAuthGuard(
	function Profile() {
		const { idTokenClaims } = useStrivacity();

		return <section>Hello, {idTokenClaims?.given_name}</section>;
	},
	{ loginUri: '/login' },
);
```

Then register the guarded component as a regular route in your router setup:

```tsx
// main.tsx
import Router, { Route } from 'preact-router';
import Profile from './pages/Profile';

<Router>
	<Route path="/profile" component={Profile} />
</Router>;
```

---

## Shared features

The Preact SDK is built on top of the core SDK and supports all its features:

- **[Storages](../sdk-core/README.md#storages)** - localStorage, sessionStorage, IndexedDB, Cache API, Memory, Worker
- **[SDK events](../sdk-core/README.md#sdk-events)** - Subscribe to authentication lifecycle events
- **[Logging](../sdk-core/README.md#logging)** - Built-in and custom logger support
- **[HTTP client](../sdk-core/README.md#http-client)** - Custom HTTP client integration
- **[Error handling](../sdk-core/README.md#error-handling)** - Typed error classes for different failure scenarios
- **[Utility functions](../sdk-core/README.md#utility-functions)** - Base64URL, JWT decoding, encryption, etc.
- **[Caching](../sdk-core/README.md#caching)** - OIDC metadata and JWKS caching

---

## Configuration reference

The Preact SDK accepts the same configuration as the core SDK. For detailed information about each option, see the [core SDK configuration reference](../sdk-core/README.md#configuration-reference).

---

## Advanced

### Ionic / Capacitor support

The SDK works with Ionic and Capacitor applications. For native mobile platforms (iOS/Android), you need to override the default `urlHandler`, `callbackHandler`, and `storage` implementations to integrate with Capacitor plugins.

```tsx
// main.tsx
import { render } from 'preact';
import { StyAuthProvider, SDKStorage, SDKHttpClient, LocalStorage } from '@strivacity/sdk-preact';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler, redirectCallbackHandler } from '@strivacity/sdk-core/utils/handlers';
import type { PluginListenerHandle } from '@capacitor/core';
import type { HttpClientResponse } from '@strivacity/sdk-preact';
import { App } from './App';

// Custom HTTP client using Capacitor's HTTP plugin
class CapacitorHttpClient extends SDKHttpClient {
	async request<T>(url: string, options?: RequestInit): Promise<HttpClientResponse<T>> {
		const response = await CapacitorHttp.request({
			url,
			method: options?.method || 'GET',
			headers: (options?.headers as Record<string, string>) || {},
			data: options?.body,
			webFetchExtra: options,
		});

		return {
			headers: new Headers(response.headers),
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			statusText: '',
			url: response.url,
			json: () => Promise.resolve(response.data),
			text: () => Promise.resolve(response.data),
		};
	}
}

// Custom storage using Capacitor Preferences
class CapacitorStorage extends SDKStorage {
	async get(key: string): Promise<string | null> {
		const { value } = await Preferences.get({ key });
		return value;
	}

	async set(key: string, value: string): Promise<void> {
		await Preferences.set({ key, value });
	}

	async delete(key: string): Promise<void> {
		await Preferences.remove({ key });
	}
}

render(
	<StyAuthProvider
		options={{
			mode: 'redirect',
			issuer: 'https://<YOUR_TENANT_DOMAIN>',
			clientId: 'YOUR_CLIENT_ID',
			redirectUri: 'https://your-app.example.com/callback',
			scopes: ['openid', 'profile', 'email'],

			// Use Capacitor HTTP on native platforms
			httpClient: CapacitorHttpClient,

			// Use Capacitor Preferences on native platforms, localStorage on web
			storage: Capacitor.getPlatform() === 'web' ? LocalStorage : CapacitorStorage,

			// Handle URL redirects with InAppBrowser on native platforms
			async urlHandler(url, responseMode) {
				if (Capacitor.getPlatform() === 'web') {
					return redirectUrlHandler(url, responseMode);
				} else {
					await InAppBrowser.openInWebView({
						url,
						options: { /* Configure InAppBrowser options */ },
					});
				}
			},

			// Handle OAuth callback with InAppBrowser listeners on native platforms
			async callbackHandler(url, responseMode) {
				if (Capacitor.getPlatform() === 'web') {
					return redirectCallbackHandler(url, responseMode);
				}

				return new Promise(async (resolve, reject) => {
					let navigationListener: PluginListenerHandle | null = null;
					let finishListener: PluginListenerHandle | null = null;
					let userCancelled = true;

					const cleanupListeners = async () => {
						if (navigationListener) {
							await navigationListener.remove();
							navigationListener = null;
						}
						if (finishListener) {
							await finishListener.remove();
							finishListener = null;
						}
					};

					try {
						// Listen for page navigation in InAppBrowser
						navigationListener = await InAppBrowser.addListener(
							'browserPageNavigationCompleted',
							async (event) => {
								const navigatedUrl = event.url;

								// Check if the navigated URL matches our callback URL
								if (navigatedUrl && navigatedUrl.startsWith(url)) {
									try {
										const urlInstance = new URL(navigatedUrl);
										const dataString = responseMode === 'query'
											? urlInstance.search
											: urlInstance.hash;
										const params = Object.fromEntries(
											new URLSearchParams(dataString.slice(1))
										);

										userCancelled = false;
										await InAppBrowser.close();
										resolve(params);
									} catch (error) {
										await InAppBrowser.close();
										reject(error);
									}
								}
							}
						);

						// Listen for browser close event
						finishListener = await InAppBrowser.addListener('browserClosed', async () => {
							await cleanupListeners();

							if (userCancelled) {
								reject(new Error('InAppBrowser flow cancelled by user.'));
							}
						});
					} catch (error) {
						await cleanupListeners();
						reject(error);
					}
				});
			},
		}}
	>
		<App />
	</StyAuthProvider>,
	document.getElementById('app')!,
);
```

> For more details on custom handlers and storage implementations, see the [core SDK advanced section](../sdk-core/README.md#advanced). For a complete working example of this pattern (using Vue, but the same concepts apply to Preact), see the [Ionic Vue example app](../../apps/ionic-vue).

### Server-side session (BFF) mode

Set `serverSessionUri` to route login through your own server instead of talking to the identity provider directly from the browser - tokens are then stored server-side and never reach client-side JavaScript. See [Server-side session management](../sdk-core/README.md#server-side-session-management) in the core SDK README for the full explanation and how to read the session on the client.

```tsx
// main.tsx
render(
	<StyAuthProvider
		options={{
			mode: 'redirect',
			issuer: 'https://<YOUR_TENANT_DOMAIN>',
			clientId: 'YOUR_CLIENT_ID',
			redirectUri: 'https://your-app.example.com/callback',
			scopes: ['openid', 'profile', 'email'],
			serverSessionUri: '/api/auth/login', // Requests are routed through your server; tokens are NOT written to client storage
		}}
	>
		<App />
	</StyAuthProvider>,
	document.getElementById('app')!,
);
```

See [`apps/preact`](../../apps/preact) paired with [`apps/backend`](../../apps/backend) for a working example. See also [Using the backend app with SPA apps](../../README.md#using-the-backend-app-with-spa-apps) in the root README.

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
