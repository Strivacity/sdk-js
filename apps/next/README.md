# Strivacity SDK - Next.js Example App

This example application demonstrates how to integrate the [@strivacity/sdk-next](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-next) SDK into a Next.js application using the App Router. It covers all supported authentication modes (`redirect`, `popup`, `native`, `embedded`) and shows how to structure file-based route authentication flows.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

The SDK is initialized via `StyAuthProvider` in `src/app/layout.tsx` and exposes the `useStrivacity` hook, which provides reactive authentication state and methods throughout the application. Next.js App Router handles client-side navigation.

## Requirements

- Next.js: 15+
- Node.js: 20 LTS+

## Install

```bash
pnpm install
```

Create a `.env.local` file in the repository root:

```env
VITE_MODE=redirect
VITE_ISSUER=your-cluster-domain
VITE_CLIENT_ID=your-client-id
VITE_SCOPES=openid profile email
VITE_REDIRECT_URI=http://localhost:4200/callback
```

Then start the development server:

```bash
pnpm app:next:serve
```

## Usage

### Initialization

The SDK is configured in `src/app/layout.tsx` using `StyAuthProvider`. All files that use the SDK must include the `'use client'` directive. Environment variables are mapped to unprefixed names via `next.config.js` and read as `process.env.MODE`, `process.env.ISSUER`, etc.

The layout also loads `bundle.js` from the configured issuer domain via `next/script`, which registers the Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`, etc.) used in `embedded` mode:

```tsx
'use client';

import { type SDKOptions, StyAuthProvider, DefaultLogging } from '@strivacity/sdk-next';
import Script from 'next/script';

const options: SDKOptions = {
	mode: process.env.MODE as 'redirect' | 'popup' | 'native',
	issuer: process.env.ISSUER as string,
	clientId: process.env.CLIENT_ID as string,
	scopes: process.env.SCOPES?.split(' ') as Array<string>,
	redirectUri: process.env.REDIRECT_URI as string,
	storageTokenName: 'sty.session.next',
	logging: DefaultLogging,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<StyAuthProvider options={options}>
			<Script src={`${process.env.ISSUER}/assets/components/bundle.js`} strategy="lazyOnload" />
			<App>{children}</App>
		</StyAuthProvider>
	);
}
```

Page components access authentication state through the `useStrivacity` hook:

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next';

export default function HomePage() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	const firstName = idTokenClaims?.given_name ?? '';

	if (loading) return <div>Loading...</div>;
	if (isAuthenticated) return <div>Welcome, {firstName}!</div>;
	return <div>Please log in.</div>;
}
```

### Login / Register

`src/app/login/page.tsx` and `src/app/register/page.tsx` initiate the authentication flow. The active mode determines how the UI is rendered:

- **`redirect`** — `login()` is called on mount; the user is taken to the identity provider in the same window.
- **`popup`** — `login()` is called on mount; authentication happens in a popup window.
- **`native`** — The `StyLoginRenderer` component renders the login UI inline using your custom widget components.
- **`embedded`** — The `<sty-login>` web component (loaded via `bundle.js` from the cluster) takes over rendering.

`src/app/callback/page.tsx` handles the response from the identity provider. It calls `sdk.handleCallback()` and redirects to `/profile` on success:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function CallbackPage() {
	const router = useRouter();
	const { sdk, loading } = useStrivacity();

	useEffect(() => {
		(async () => {
			const url = new URL(location.href);
			if (url.searchParams.has('session_id')) {
				router.push(`/login?${url.searchParams}`);
			} else {
				if (loading) return;
				try {
					await sdk.handleCallback();
					router.push('/profile');
				} catch (error) {
					console.error('Error during callback handling:', error);
				}
			}
		})();
	}, [loading]);

	return <h1>Logging in...</h1>;
}
```

### Refresh token

Token refresh runs automatically when the SDK detects an expired access token. The `sdk.refresh()` method is also available for manual invocation:

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next';

export default function ProfilePage() {
	const { sdk } = useStrivacity();

	return <button onClick={() => void sdk.refresh()}>Refresh token</button>;
}
```

### Revoke session / logout

`src/app/revoke/page.tsx` revokes the current session tokens without a full logout. It checks `isAuthenticated` before calling `revoke()` and then returns to the home page:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function RevokePage() {
	const router = useRouter();
	const { isAuthenticated, revoke } = useStrivacity();

	useEffect(() => {
		(async () => {
			if (isAuthenticated) {
				await revoke();
			}
			router.push('/');
		})();
	}, []);

	return <h1>Logging out...</h1>;
}
```

`src/app/logout/page.tsx` performs a full logout. When the user is authenticated, `logout()` is called with `postLogoutRedirectUri` set to the application origin; otherwise the user is immediately redirected home:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function LogoutPage() {
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

	return <h1>Logging out...</h1>;
}
```

### Resume an externally-initiated flow

`src/app/entry/page.tsx` handles flows started by an external process (e.g. password reset, magic link, invite). On mount it calls `entry()`, which processes the incoming URL and returns a `session_id` (and optionally a `short_app_id`). These are forwarded as query parameters to `/callback` to resume the flow; if no data is returned the user is redirected to the home page:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function EntryPage() {
	const router = useRouter();
	const { loading, entry } = useStrivacity();

	useEffect(() => {
		if (loading) return;
		(async () => {
			try {
				const data = await entry();
				if (data && Object.keys(data).length > 0) {
					router.push(`/callback?${new URLSearchParams(data).toString()}`);
				} else {
					router.push('/');
				}
			} catch (error) {
				alert(error);
				router.push('/');
			}
		})();
	}, [loading]);

	return <h1>Redirecting...</h1>;
}
```

The callback page detects the `session_id` parameter and forwards it to `/login` to continue the native or embedded flow, instead of running the standard `handleCallback()` path.

The login page extracts `session_id` and `short_app_id` from the URL on load, cleans up the URL, and passes them to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new login.

You can also navigate directly to `/login?session_id=<id>` to resume a flow without going through the entry page, which is useful when the `session_id` is obtained through your own backend logic.

## Logging

Enable the built-in console logger by passing `logging: DefaultLogging` to the SDK options:

```typescript
import { DefaultLogging } from '@strivacity/sdk-next';

// ...within your SDK options:
logging: DefaultLogging,
```

The default logger writes to the browser console and prefixes messages with the `xEventId` correlation ID when available.

To use a custom logger, implement the `SDKLogging` interface and register your class in the SDK options:

```typescript
import type { SDKLogging } from '@strivacity/sdk-next';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		console.debug(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	info(message: string): void {
		console.info(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	warn(message: string): void {
		console.warn(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	error(message: string, error: Error): void {
		console.error(this.xEventId ? `(${this.xEventId}) ${message}` : message, error);
	}
}
```

```typescript
import { MyLogger } from './logging/MyLogger';

// ...within your SDK options:
logging: MyLogger,
```

## Pages

| Page     | Path                        | Description                                                                                                                                                        |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home     | `src/app/page.tsx`          | Public landing page. Displays user info when authenticated.                                                                                                        |
| Login    | `src/app/login/page.tsx`    | Entry point for the authentication flow. Accepts optional `session_id` and `short_app_id` URL parameters to resume an existing flow instead of starting a new one. |
| Register | `src/app/register/page.tsx` | Entry point for the registration flow. Mirrors the login page structure with an extra `prompt: create` parameter passed to the authentication request.             |
| Callback | `src/app/callback/page.tsx` | Handles the identity provider's redirect response. Routes to the login page when a `session_id` is present, otherwise completes the standard authorization flow.   |
| Entry    | `src/app/entry/page.tsx`    | Entry point for externally-initiated flows (e.g. password reset). Processes the incoming URL and routes to the appropriate next step.                              |
| Profile  | `src/app/profile/page.tsx`  | Protected page showing the authenticated user's session details and token information.                                                                             |
| Revoke   | `src/app/revoke/page.tsx`   | Invalidates the current session tokens without a full logout and returns the user to the home page.                                                                |
| Logout   | `src/app/logout/page.tsx`   | Terminates the user's session and redirects to the home page after logout.                                                                                         |

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This example app is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
