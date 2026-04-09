# Strivacity SDK - Web Component Example App

This example application demonstrates how to integrate the [@strivacity/sdk-core](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core) SDK into a web component application built with Lit and `@lit-labs/router`. It covers all supported authentication modes (`redirect`, `popup`, `embedded`) and shows how to structure custom-element-based authentication flows without a framework.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

The SDK is initialized globally in the root `AppComponent` using `initFlow()`, and the result is stored on `globalThis.sdk`. All custom elements access authentication state and methods directly through `globalThis.sdk`. The `@lit-labs/router` handles client-side navigation between pages.

## Requirements

- Lit: 3+
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
pnpm app:wc:serve
```

## Usage

### Initialization

The SDK is initialized in `src/components/app.component.ts` using `initFlow()`. The result is stored on `globalThis` so that any custom element can access it without imports or prop-drilling. The root component also dynamically imports `bundle.js` from the configured issuer domain, which registers the Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`, etc.) used in `embedded` mode:

```typescript
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Router } from '@lit-labs/router';
import { initFlow, DefaultLogging, type SDKOptions } from '@strivacity/sdk-core';

declare global {
	interface Window {
		sdk: ReturnType<typeof initFlow>;
	}
}

@customElement('app-root')
export class AppComponent extends LitElement {
	private router: Router;

	constructor() {
		super();

		const options: SDKOptions = {
			mode: import.meta.env.VITE_MODE,
			issuer: import.meta.env.VITE_ISSUER,
			scopes: import.meta.env.VITE_SCOPES.split(' '),
			clientId: import.meta.env.VITE_CLIENT_ID,
			redirectUri: import.meta.env.VITE_REDIRECT_URI,
			storageTokenName: 'sty.session.web-component',
			logging: DefaultLogging,
		};

		globalThis.sdk = initFlow(options);
		void import(`${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);

		this.router = new Router(this, [
			{
				path: '/',
				render: () => html`
					<page-home></page-home>
				`,
			},
			{
				path: '/login',
				render: () => html`
					<page-login></page-login>
				`,
			},
			{
				path: '/register',
				render: () => html`
					<page-register></page-register>
				`,
			},
			{
				path: '/callback',
				render: () => html`
					<page-callback></page-callback>
				`,
			},
			{
				path: '/profile',
				render: () => html`
					<page-profile></page-profile>
				`,
			},
			{
				path: '/logout',
				render: () => html`
					<page-logout></page-logout>
				`,
			},
			{
				path: '/revoke',
				render: () => html`
					<page-revoke></page-revoke>
				`,
			},
		]);
	}

	render() {
		return html`
			${this.router.outlet()}
		`;
	}
}
```

Custom elements access the SDK directly from `globalThis.sdk`:

```typescript
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('page-home')
export class HomeComponent extends LitElement {
	@state() private loading = true;
	@state() private isAuthenticated = false;

	async connectedCallback() {
		super.connectedCallback();
		this.loading = true;
		this.isAuthenticated = await globalThis.sdk.isAuthenticated;
		this.loading = false;
	}

	render() {
		if (this.loading)
			return html`
				<p>Loading...</p>
			`;
		if (this.isAuthenticated)
			return html`
				<p>Welcome!</p>
			`;
		return html`
			<p>Please log in.</p>
		`;
	}
}
```

### Login / Register

`src/components/pages/login.component.ts` and `src/components/pages/register.component.ts` initiate the authentication flow. The active mode determines how the UI is rendered:

- **`redirect`** — `globalThis.sdk.login()` is called on mount; the user is taken to the identity provider in the same window.
- **`popup`** — `globalThis.sdk.login()` is called on mount; authentication happens in a popup window.
- **`embedded`** — The `<sty-login>` web component (loaded via `bundle.js` from the cluster) takes over rendering.

`src/components/pages/callback.component.ts` handles the response from the identity provider. It calls `globalThis.sdk.handleCallback()` and navigates to `/profile` on success:

```typescript
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-callback')
export class CallbackComponent extends LitElement {
	async connectedCallback() {
		super.connectedCallback();
		const url = new URL(location.href);
		if (url.searchParams.has('session_id')) {
			history.pushState({}, '', `/login?${url.searchParams}`);
			dispatchEvent(new PopStateEvent('popstate'));
		} else {
			try {
				await globalThis.sdk.handleCallback();
				history.pushState({}, '', '/profile');
				dispatchEvent(new PopStateEvent('popstate'));
			} catch (error) {
				console.error('Error during callback handling:', error);
			}
		}
	}

	render() {
		return html`
			<h1>Logging in...</h1>
		`;
	}
}
```

### Refresh token

Token refresh runs automatically when the SDK detects an expired access token. The `refresh` method on `globalThis.sdk` is also available for manual invocation:

```typescript
await globalThis.sdk.refresh();
```

### Revoke session / logout

`src/components/pages/revoke.component.ts` revokes the current session tokens without a full logout. It checks `isAuthenticated` before calling `revoke()` and then navigates to the home page:

```typescript
async connectedCallback() {
    super.connectedCallback();
    if (await globalThis.sdk.isAuthenticated) {
        await globalThis.sdk.revoke();
    }
    history.pushState({}, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
}
```

`src/components/pages/logout.component.ts` performs a full logout. When the user is authenticated, `logout()` is called with `postLogoutRedirectUri` set to the application origin; otherwise the user is immediately navigated home:

```typescript
async connectedCallback() {
    super.connectedCallback();
    if (await globalThis.sdk.isAuthenticated) {
        await globalThis.sdk.logout({ postLogoutRedirectUri: location.origin });
    } else {
        history.pushState({}, "", "/");
        dispatchEvent(new PopStateEvent("popstate"));
    }
}
```

## Logging

Enable the built-in console logger by passing `logging: DefaultLogging` to the SDK options:

```typescript
import { DefaultLogging } from '@strivacity/sdk-core';

// ...within your SDK options:
logging: DefaultLogging,
```

The default logger writes to the browser console and prefixes messages with the `xEventId` correlation ID when available.

To use a custom logger, implement the `SDKLogging` interface and register your class in the SDK options:

```typescript
import type { SDKLogging } from '@strivacity/sdk-core';

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

| Page     | Path                                         | Description                                                                                                                                                      |
| -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home     | `src/components/pages/home.component.ts`     | Public landing page. Displays user info when authenticated.                                                                                                      |
| Login    | `src/components/pages/login.component.ts`    | Entry point for the authentication flow. Accepts optional `session_id` and `short_app_id` URL parameters to resume an existing embedded flow.                    |
| Register | `src/components/pages/register.component.ts` | Entry point for the registration flow. Mirrors the login page structure with an extra `prompt: create` parameter passed to the authentication request.           |
| Callback | `src/components/pages/callback.component.ts` | Handles the identity provider's redirect response. Routes to the login page when a `session_id` is present, otherwise completes the standard authorization flow. |
| Profile  | `src/components/pages/profile.component.ts`  | Protected page showing the authenticated user's session details and token information. Redirects to `/login` if not authenticated.                               |
| Revoke   | `src/components/pages/revoke.component.ts`   | Invalidates the current session tokens without a full logout and returns the user to the home page.                                                              |
| Logout   | `src/components/pages/logout.component.ts`   | Terminates the user's session and redirects to the home page after logout.                                                                                       |

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This example app is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
