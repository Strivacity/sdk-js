# Strivacity SDK - Ionic React Example App

This example application demonstrates how to integrate the [@strivacity/sdk-react](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-react) SDK into an Ionic React application with Capacitor. It covers all supported authentication modes (`redirect`, `popup`, `native`, `embedded`) on both web and native mobile platforms (Android, iOS).

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

The app extends the React SDK example with Capacitor-specific adapters. On mobile platforms, `CapacitorStorage` replaces localStorage with `@capacitor/preferences`, and authentication redirects are handled via `@capacitor/inappbrowser` instead of standard browser navigation. The `useStrivacity` hook provides reactive authentication state and methods throughout the application.

## Requirements

- React: 19+
- Ionic: 8+
- Capacitor: 7+
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
# Web
pnpm app:ionic-react:serve

# Android
pnpm app:ionic-react:android:run

# iOS
pnpm app:ionic-react:ios:run
```

## Usage

### Initialization

The SDK is configured in `src/main.tsx` via `StyAuthProvider`. Platform detection is used to select the appropriate storage and URL/callback handlers. The app also dynamically imports `bundle.js` from the configured issuer domain, which registers the Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`, etc.) used in `embedded` mode:

```tsx
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { StyAuthProvider, DefaultLogging, type SDKOptions, type SDKStorage, type SDKHttpClient } from '@strivacity/sdk-react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler, redirectCallbackHandler } from '@strivacity/sdk-react';

const isNative = Capacitor.getPlatform() !== 'web';

class CapacitorHttpClient implements SDKHttpClient {
	async request(url: string, options: RequestInit = {}): Promise<Response> {
		const response = await CapacitorHttp.request({
			url,
			method: (options.method as string) ?? 'GET',
			headers: options.headers as Record<string, string>,
			data: options.body,
		});
		return new Response(JSON.stringify(response.data), { status: response.status, headers: response.headers });
	}
}

class CapacitorStorage implements SDKStorage {
	async get(key: string): Promise<string | null> {
		const { value } = await Preferences.get({ key });
		return value;
	}
	async set(key: string, value: string): Promise<void> {
		await Preferences.set({ key, value });
	}
	async remove(key: string): Promise<void> {
		await Preferences.remove({ key });
	}
}

const options: SDKOptions = {
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.react',
	logging: DefaultLogging,
	storage: isNative ? CapacitorStorage : undefined,
	httpClient: isNative ? CapacitorHttpClient : undefined,
	urlHandler: isNative ? async (url) => InAppBrowser.openInWebView({ url }) : redirectUrlHandler,
	callbackHandler: isNative
		? () =>
				new Promise((resolve) => {
					/* InAppBrowser navigation listener */
				})
		: redirectCallbackHandler,
};

createRoot(document.getElementById('app')!).render(
	<BrowserRouter>
		<StyAuthProvider options={options}>
			<Routes>{/* route definitions */}</Routes>
		</StyAuthProvider>
	</BrowserRouter>,
);
```

Components access authentication state through the `useStrivacity` hook — identical to the React example app:

```tsx
import { useStrivacity } from '@strivacity/sdk-react';

export const Home = () => {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	const firstName = idTokenClaims?.given_name ?? '';

	if (loading) return <div>Loading...</div>;
	if (isAuthenticated) return <div>Welcome, {firstName}!</div>;
	return <div>Please log in.</div>;
};
```

### Login / Register

`src/pages/Login.tsx` and `src/pages/Register.tsx` initiate the authentication flow. The active mode determines how the UI is rendered:

- **`redirect`** — `login()` is called on mount; the user is taken to the identity provider (or InAppBrowser on mobile).
- **`popup`** — `login()` is called on mount; authentication happens in a popup window.
- **`native`** — The `StyLoginRenderer` component renders the login UI inline using your custom widget components.
- **`embedded`** — The `<sty-login>` web component (loaded via `bundle.js` from the cluster) takes over rendering.

`src/pages/Callback.tsx` handles the response from the identity provider. It calls `sdk.handleCallback()` and navigates to `/profile` on success.

### Refresh token

Token refresh runs automatically when the SDK detects an expired access token. The `refresh` method is also available via the hook for manual invocation:

```tsx
const { refresh } = useStrivacity();
```

### Revoke session / logout

`src/pages/Revoke.tsx` revokes the current session tokens without a full logout, then returns to the home page.

`src/pages/Logout.tsx` performs a full logout. When the user is authenticated, `logout()` is called with `postLogoutRedirectUri` set to the application origin.

### Resume an externally-initiated flow

`src/pages/Entry.tsx` handles flows started by an external process (e.g. password reset, magic link, invite). On mount it calls `entry()`, which processes the incoming URL and returns a `session_id` (and optionally a `short_app_id`). These are forwarded as query parameters to `/callback` to resume the flow.

The callback page detects the `session_id` parameter and forwards it to `/login` to continue the native or embedded flow, instead of running the standard `handleCallback()` path.

You can also navigate directly to `/login?session_id=<id>` to resume a flow without going through the entry page, which is useful when the `session_id` is obtained through your own backend logic.

## Logging

Enable the built-in console logger by passing `logging: DefaultLogging` to the SDK options:

```typescript
import { DefaultLogging } from '@strivacity/sdk-react';

// ...within your SDK options:
logging: DefaultLogging,
```

The default logger writes to the browser console and prefixes messages with the `xEventId` correlation ID when available.

To use a custom logger, implement the `SDKLogging` interface and register your class in the SDK options:

```typescript
import type { SDKLogging } from '@strivacity/sdk-react';

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

| Page     | Path                     | Description                                                                                                                                                                                                                      |
| -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home     | `src/pages/Home.tsx`     | Public landing page. Displays user info when authenticated.                                                                                                                                                                      |
| Login    | `src/pages/Login.tsx`    | Entry point for the authentication flow. Accepts optional `session_id` and `short_app_id` URL parameters to resume an existing flow instead of starting a new one. An optional `language` URL parameter overrides the UI locale. |
| Register | `src/pages/Register.tsx` | Entry point for the registration flow. Mirrors the login page structure with an extra `prompt: create` parameter. Also accepts an optional `language` URL parameter to override the UI locale.                                   |
| Callback | `src/pages/Callback.tsx` | Handles the identity provider's redirect response. Routes to the login page when a `session_id` is present, otherwise completes the standard authorization flow.                                                                 |
| Entry    | `src/pages/Entry.tsx`    | Entry point for externally-initiated flows (e.g. password reset). Processes the incoming URL and routes to the appropriate next step.                                                                                            |
| Profile  | `src/pages/Profile.tsx`  | Protected page showing the authenticated user's session details and token information. Redirects to `/login` if not authenticated.                                                                                               |
| Revoke   | `src/pages/Revoke.tsx`   | Invalidates the current session tokens without a full logout and returns the user to the home page.                                                                                                                              |
| Logout   | `src/pages/Logout.tsx`   | Terminates the user's session and redirects to the home page after logout.                                                                                                                                                       |

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This example app is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
