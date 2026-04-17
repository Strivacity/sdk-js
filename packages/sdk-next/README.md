# @strivacity/sdk-next

A Next.js library that integrates Strivacity's policy-driven authentication journeys into your application using the OAuth 2.0 PKCE flow. Supports `redirect`, `popup`, `native`, and `embedded` modes.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

This SDK allows you to integrate Strivacity's policy-driven journeys into your Next.js application. It wraps the `@strivacity/sdk-core` library as a React context provider and exposes a `useStrivacity` hook that provides authentication state and methods throughout your component tree. The SDK uses the OAuth 2.0 PKCE flow to authenticate with Strivacity. For detailed configuration options, available modes, and advanced usage refer to the [`@strivacity/sdk-core` documentation](https://github.com/Strivacity/sdk-js/blob/main/packages/sdk-core/README.md).

## Demo Application

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/next)
- [Headless example app](https://github.com/Strivacity/sdk-js/tree/main/apps/next-headless)

## Requirements

- Next.js: 14+

## Install

```bash
npm install @strivacity/sdk-next
```

## Usage

### Initialization

Wrap your application with `StyAuthProvider` in your root layout. Use the `'use client'` directive since the provider uses React context:

```tsx
// app/providers.tsx
'use client';

import { StyAuthProvider, type SDKOptions } from '@strivacity/sdk-next';

const options: SDKOptions = {
	mode: 'redirect', // or 'popup', 'native', 'embedded'
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
};

export function Providers({ children }: { children: React.ReactNode }) {
	return <StyAuthProvider options={options}>{children}</StyAuthProvider>;
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
```

Use the `useStrivacity` hook in any client component to access authentication state:

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next';

export default function MyComponent() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
}
```

### Redirect / Popup mode

In `redirect` mode the user is taken to the identity provider in the same window; in `popup` mode authentication happens in a popup. Both are initiated the same way from code.

#### Login page example

```tsx
'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Login() {
	const { login } = useStrivacity();

	useEffect(() => {
		login();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
}
```

#### Callback page example

The callback page handles the response from the identity provider. It calls `handleCallback()` and redirects to `/profile` on success:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Callback() {
	const router = useRouter();
	const { handleCallback } = useStrivacity();

	useEffect(() => {
		(async () => {
			try {
				await handleCallback();
				router.push('/profile');
			} catch (error) {
				console.error('Error during callback handling:', error);
			}
		})();
	}, []);

	return (
		<section>
			<h1>Logging in...</h1>
		</section>
	);
}
```

#### Profile page example

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next';

export default function Profile() {
	const { loading, isAuthenticated, accessToken, accessTokenExpired, accessTokenExpirationDate, idTokenClaims, refreshToken } = useStrivacity();

	if (loading) {
		return <h1>Loading...</h1>;
	}

	return (
		<section>
			<dl>
				<dt>
					<strong>accessToken</strong>
				</dt>
				<dd>
					<pre>{JSON.stringify(accessToken)}</pre>
				</dd>
				<dt>
					<strong>refreshToken</strong>
				</dt>
				<dd>
					<pre>{JSON.stringify(refreshToken)}</pre>
				</dd>
				<dt>
					<strong>accessTokenExpired</strong>
				</dt>
				<dd>
					<pre>{JSON.stringify(accessTokenExpired)}</pre>
				</dd>
				<dt>
					<strong>accessTokenExpirationDate</strong>
				</dt>
				<dd>
					<pre>{accessTokenExpirationDate ? new Date(accessTokenExpirationDate * 1000).toLocaleString() : JSON.stringify(null)}</pre>
				</dd>
				<dt>
					<strong>claims</strong>
				</dt>
				<dd>
					<pre>{JSON.stringify(idTokenClaims, null, 2)}</pre>
				</dd>
			</dl>
		</section>
	);
}
```

#### Logout page example

The `postLogoutRedirectUri` parameter is optional and specifies where users are redirected after logout. This URI must be configured in the Admin Console as an allowed post-logout redirect URI.

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Logout() {
	const router = useRouter();
	const { isAuthenticated, logout } = useStrivacity();

	useEffect(() => {
		(async () => {
			if (isAuthenticated) {
				await logout({ postLogoutRedirectUri: location.origin });
			} else {
				router.push('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Logging out...</h1>
		</section>
	);
}
```

#### Component example

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next';

export default function Nav() {
	const { isAuthenticated, idTokenClaims, login, logout } = useStrivacity();
	const name = `${idTokenClaims?.given_name} ${idTokenClaims?.family_name}`;

	return isAuthenticated ? (
		<div>
			<div>Welcome, {name}!</div>
			<button onClick={() => logout()}>Logout</button>
		</div>
	) : (
		<div>
			<div>Not logged in</div>
			<button onClick={() => login()}>Log in</button>
		</div>
	);
}
```

### Native mode

In `native` mode the `StyLoginRenderer` component renders the authentication UI inline using your custom widget components. You can define custom components for each input type; see [Example widgets](https://github.com/Strivacity/sdk-js/tree/main/apps/next/src/components/widgets).

The example widgets use SCSS for styling and Luxon for date handling:

```bash
npm install sass luxon
npm install --save-dev @types/luxon
```

```tsx
import CheckboxWidget from './checkbox.widget';
import DateWidget from './date.widget';
import InputWidget from './input.widget';
import LayoutWidget from './layout.widget';
import MultiSelectWidget from './multiselect.widget';
import PasscodeWidget from './passcode.widget';
import LoadingWidget from './loading.widget';
import PasswordWidget from './password.widget';
import PhoneWidget from './phone.widget';
import SelectWidget from './select.widget';
import StaticWidget from './static.widget';
import SubmitWidget from './submit.widget';

export const widgets = {
	checkbox: CheckboxWidget,
	date: DateWidget,
	input: InputWidget,
	layout: LayoutWidget,
	loading: LoadingWidget,
	passcode: PasscodeWidget,
	password: PasswordWidget,
	phone: PhoneWidget,
	select: SelectWidget,
	multiSelect: MultiSelectWidget,
	static: StaticWidget,
	submit: SubmitWidget,
};
```

#### Login page example

The login page extracts `session_id` and optionally `language` from the URL on load, cleans up the URL, and passes them to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new one. When a `language` parameter is present it overrides `uiLocales` to display the authentication UI in the specified language.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StyLoginRenderer, FallbackError, type LoginFlowState } from '@strivacity/sdk-next';
import { widgets } from '@/components/widgets';

export default function Login() {
	const router = useRouter();
	const [sessionId, setSessionId] = useState<string | null>(null);

	useEffect(() => {
		if (window.location.search !== '') {
			const url = new URL(window.location.href);
			setSessionId(url.searchParams.get('session_id'));
			url.search = '';
			window.history.replaceState({}, '', url.toString());
		}
	}, []);

	const onLogin = async () => {
		router.push('/profile');
	};

	const onFallback = (error: FallbackError) => {
		if (error.url) {
			window.location.href = error.url.toString();
		} else {
			alert(error);
		}
	};

	const onError = (error: string) => {
		alert(error);
	};

	const onGlobalMessage = (message: string) => {
		alert(message);
	};

	const onBlockReady = ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => {
		console.log('previousState', previousState);
		console.log('state', state);
	};

	return (
		<StyLoginRenderer
			widgets={widgets}
			sessionId={sessionId}
			onFallback={onFallback}
			onLogin={() => void onLogin()}
			onError={onError}
			onGlobalMessage={onGlobalMessage}
			onBlockReady={onBlockReady}
		/>
	);
}
```

#### Callback page example

When a `session_id` is present in the URL the native flow is resumed by forwarding it to the login page. Otherwise the standard `handleCallback()` path is used:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Callback() {
	const router = useRouter();
	const { handleCallback } = useStrivacity();

	useEffect(() => {
		(async () => {
			const url = new URL(location.href);
			const sessionId = url.searchParams.get('session_id');

			if (sessionId) {
				router.push(`/login?session_id=${sessionId}`);
			} else {
				try {
					await handleCallback();
					router.push('/profile');
				} catch (error) {
					console.error('Error during callback handling:', error);
				}
			}
		})();
	}, []);

	return (
		<section>
			<h1>Logging in...</h1>
		</section>
	);
}
```

#### Entry page example

The entry page processes flows started by an external process (e.g. password reset) by calling `entry()` to extract the necessary parameters to resume the flow and forwarding them to the callback page:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Entry() {
	const router = useRouter();
	const { entry } = useStrivacity();

	useEffect(() => {
		(async () => {
			try {
				const data = await entry();

				if (data && Object.keys(data).length > 0) {
					router.push(`/callback?${new URLSearchParams(data).toString()}`);
				} else {
					router.push('/');
				}
			} catch (error) {
				console.error('Entry failed:', error);
				router.push('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Loading...</h1>
		</section>
	);
}
```

#### Profile page example

Same as the profile page example in redirect/popup mode.

#### Logout page example

Same as the logout page example in redirect/popup mode.

### Embedded mode

In `embedded` mode the `<sty-login>` web component (loaded via `bundle.js` from the cluster) handles rendering. Import the bundle at application startup to register the Strivacity web components:

```tsx
// app/providers.tsx
'use client';

import { useEffect } from 'react';
import { StyAuthProvider } from '@strivacity/sdk-next';

export function Providers({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		void import(`${process.env.NEXT_PUBLIC_ISSUER}/assets/components/bundle.js`);
	}, []);

	return (
		<StyAuthProvider
			options={{
				mode: 'embedded',
				issuer: 'https://<YOUR_DOMAIN>',
				scopes: ['openid', 'profile'],
				clientId: '<YOUR_CLIENT_ID>',
				redirectUri: '<YOUR_REDIRECT_URI>',
			}}
		>
			{children}
		</StyAuthProvider>
	);
}
```

## Logging

The SDK supports optional logging to help you debug authentication flows and monitor SDK behavior. You can enable the built-in console logger or provide your own custom logger implementation.

### Using the Default Logger

Enable the default console logger by adding the `logging` option:

```tsx
import { StyAuthProvider, DefaultLogging, type SDKOptions } from '@strivacity/sdk-next';

const options: SDKOptions = {
	mode: 'redirect',
	issuer: 'https://<YOUR_DOMAIN>',
	scopes: ['openid', 'profile'],
	clientId: '<YOUR_CLIENT_ID>',
	redirectUri: '<YOUR_REDIRECT_URI>',
	logging: DefaultLogging,
};
```

### Creating a Custom Logger

Implement the `SDKLogging` interface and pass your class to the `logging` option:

```typescript
import type { SDKLogging } from '@strivacity/sdk-next';

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

The `SDKLogging` interface requires `debug`, `info`, `warn`, and `error` methods. The optional `xEventId` property, when set by the SDK, provides a correlation ID to trace related log messages across the authentication flow.

## API Documentation

### `useStrivacity` hook

```typescript
useStrivacity<T extends PopupContext | RedirectContext | NativeContext>(): T;
```

The hook returns a different context type depending on the `mode` configured in `StyAuthProvider`.

**Shared properties (all modes)**

- **`sdk: RedirectFlow | PopupFlow | NativeFlow`**: The underlying SDK flow instance.
- **`loading: boolean`**: `true` while the session is being initialized.
- **`options: SDKOptions`**: The configured SDK options.
- **`isAuthenticated: boolean`**: `true` when the user has a valid session.
- **`idTokenClaims: IdTokenClaims | null`**: Claims from the ID token, or `null` if not authenticated.
- **`accessToken: string | null`**: The current access token.
- **`refreshToken: string | null`**: The current refresh token.
- **`accessTokenExpired: boolean`**: `true` when the access token has expired.
- **`accessTokenExpirationDate: number | null`**: Expiration timestamp (Unix seconds) of the access token.

---

**Type: `RedirectContext`**

- **`login(options?: LoginOptions): Promise<void>`**: Initiates login by redirecting to the identity provider.
- **`register(options?: RegisterOptions): Promise<void>`**: Initiates registration using a redirect flow.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via redirect.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback after redirect.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL and returns the parameters needed to resume the flow.

---

**Type: `PopupContext`**

- **`login(options?: LoginOptions): Promise<void>`**: Initiates login using a popup window.
- **`register(options?: RegisterOptions): Promise<void>`**: Initiates registration using a popup.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via popup.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL.

---

**Type: `NativeContext`**

- **`login(options?: LoginOptions): Promise<NativeFlowHandler>`**: Initiates login using the native flow.
- **`register(options?: RegisterOptions): Promise<NativeFlowHandler>`**: Initiates registration using the native flow.
- **`refresh(): Promise<void>`**: Refreshes the user's session.
- **`revoke(): Promise<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Promise<void>`**: Logs the user out via redirect.
- **`handleCallback(url?: string): Promise<void>`**: Processes the authorization callback.
- **`entry(): Promise<Record<string, string>>`**: Processes an externally-initiated flow URL.

---

### `StyLoginRenderer` component

Used in `native` mode to render the authentication UI with your own widget components.

**Props**

- **`params?: NativeParams`**: Additional parameters for the native login flow.
- **`widgets?: PartialRecord<WidgetType, React.ComponentType>`**: Custom React components for each widget type used in the flow.
- **`sessionId?: string | null`**: Session ID for resuming an existing authentication session.

**Event callbacks**

- **`onLogin`**: Called on successful authentication. Receives `IdTokenClaims | null`.
- **`onFallback`**: Called when the native flow needs to fall back to redirect. Receives `FallbackError` with a fallback URL.
- **`onError`**: Called when an error occurs during authentication.
- **`onGlobalMessage`**: Called when the flow wants to display a global message (e.g. account lockout warning).
- **`onBlockReady`**: Called on flow state transitions. Receives `{ previousState: LoginFlowState; state: LoginFlowState }`. Useful for analytics and custom logging.

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

@strivacity/sdk-next is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).

## Migrating to v3.0

### Entry API Major Changes

Strivacity SDK's `entry()` API now returns a structured object instead of a plain string. Check the example above in the usage section for more details.
