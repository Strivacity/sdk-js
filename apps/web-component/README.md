# Strivacity SDK - Web Components Example App

This example application demonstrates how to integrate the Strivacity SDK into a Web Components application using Lit for building fast, lightweight web components with reactive properties and declarative templates.

## Key Features and Implementation

### 1. Web Components Dependencies

This Web Components application uses the Strivacity Core SDK directly with Lit for component creation (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-core": "*"
}
```

### 2. Global SDK Initialization

The application initializes the SDK once at the application level and exposes it globally for use across all components (see [src/components/app.component.ts](./src/components/app.component.ts)):

```typescript
import { initFlow } from '@strivacity/sdk-core';
import { DefaultLogging } from '@strivacity/sdk-core/utils/Logging';

globalThis.sdk = initFlow({
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.web-component',
	logging: DefaultLogging,
});
```

### 3. Lit Component Pattern

The application uses Lit's decorator-based API for creating reactive web components (see [src/components/app.component.ts](./src/components/app.component.ts)):

```typescript
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { state } from 'lit/decorators/state.js';

@customElement('app-main')
export class AppComponent extends LitElement {
	@state() name = '';
	@state() isAuthenticated = false;

	async init() {
		this.isAuthenticated = await globalThis.sdk.isAuthenticated;

		if (this.isAuthenticated) {
			this.name = `${globalThis.sdk.idTokenClaims?.given_name ?? ''} ${globalThis.sdk.idTokenClaims?.family_name ?? ''}`;
		}
	}

	render() {
		return html`
			<header>
				${this.isAuthenticated
					? html`
							<strong>Welcome, ${this.name}!</strong>
						`
					: nothing}
			</header>
		`;
	}
}
```

### 4. Client-Side Routing

The application uses Lit Router for declarative, component-based routing (see [src/components/app.component.ts](./src/components/app.component.ts)):

```typescript
import { Router } from '@lit-labs/router';

@customElement('app-main')
export class AppComponent extends LitElement {
	readonly router = new Router(this, [
		{
			path: '/',
			render: () => html`
				<page-index></page-index>
			`,
		},
		{
			path: '/login',
			render: () => html`
				<page-login></page-login>
			`,
		},
		{
			path: '/profile',
			enter: async () => {
				this.isAuthenticated = await globalThis.sdk.isAuthenticated;

				if (!this.isAuthenticated) {
					void this.router.goto('/login');
				}

				return this.isAuthenticated;
			},
			render: () => html`
				<page-profile></page-profile>
			`,
		},
	]);
}
```

### 5. Logging

You can enable SDK logging or plug in your own logger.

- Enable default logging by adding `logging: DefaultLogging` to the SDK initialization. The default logger writes to the browser console and automatically prefixes messages with an `xEventId` property when available

```typescript
import { initFlow } from '@strivacity/sdk-core';
import { DefaultLogging } from '@strivacity/sdk-core/utils/Logging';

globalThis.sdk = initFlow({
	// ...other options
	logging: DefaultLogging, // enable built-in console logging
});
```

- Provide a custom logger by implementing the `SDKLogging` interface (methods: `debug`, `info`, `warn`, `error`). An optional `xEventId` property is honored for log correlation. See the built-in implementation for reference in [packages/sdk-core/src/utils/Logging.ts](../../packages/sdk-core/src/utils/Logging.ts).

```ts
import type { SDKLogging } from '@strivacity/sdk-core';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		// e.g., send to your logging pipeline
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

Then register your logger class in the SDK initialization:

```typescript
import { initFlow } from '@strivacity/sdk-core';
import { MyLogger } from './logging/MyLogger';

globalThis.sdk = initFlow({
	// ...other options
	logging: MyLogger,
});
```

### 6. Component Structure

The application uses custom elements for pages, each with specific authentication responsibilities:

```
src/
├── components/
│   └── app.component.ts    # Main app shell with router
└── pages/
    ├── index.page.ts       # Home page
    ├── login.page.ts       # Login page
    ├── register.page.ts    # Registration page
    ├── callback.page.ts    # OAuth callback handler
    ├── profile.page.ts     # Protected profile page
    ├── logout.page.ts      # Logout page
    └── revoke.page.ts      # Token revocation page
```

## Installation and Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables Setup

Create a `.env.local` file in the repository root:

```env
VITE_ISSUER=your-cluster-domain
VITE_CLIENT_ID=your-client-id
VITE_SCOPES=openid profile email
VITE_REDIRECT_URI=http://localhost:3000/callback
VITE_MODE=redirect
```

### 3. Running the Application

```bash
pnpm app:web-component:serve
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is initialized globally and accessed directly through `globalThis.sdk` across all components (see [src/components/app.component.ts](./src/components/app.component.ts)).

### Component Patterns

Web components access authentication state and methods directly from the global SDK instance:

```typescript
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { state } from 'lit/decorators/state.js';

@customElement('my-component')
export class MyComponent extends LitElement {
	@state() isAuthenticated = false;

	async connectedCallback() {
		super.connectedCallback();
		this.isAuthenticated = await globalThis.sdk.isAuthenticated;
	}

	render() {
		return html`
			<div>
				${this.isAuthenticated
					? html`
							<p>Logged in</p>
						`
					: html`
							<p>Logged out</p>
						`}
			</div>
		`;
	}
}
```

### Pages

Brief, purpose-oriented descriptions of page components under src/pages — what they do, expected behavior, and how they use the global SDK instance.

- src/pages/index.page.ts
  - Purpose: Landing / home page. Publicly accessible; introduces the app and provides links to login/register.
  - Behavior: Displays public content. Can conditionally show user info if authenticated by accessing globalThis.sdk.isAuthenticated and globalThis.sdk.idTokenClaims.
  - Usage: Simple Lit component that renders basic content and navigation links.

- src/pages/login.page.ts
  - Purpose: Login page / entry point for authentication flows.
  - Behavior: On component connection (connectedCallback), triggers globalThis.sdk.login() which initiates the redirect/popup flow. Shows "Redirecting..." message.
  - Usage: Minimal component that calls globalThis.sdk.login() with optional parameters (loginHint, acrValues, uiLocales, audiences).

- src/pages/register.page.ts
  - Purpose: Registration page (if supported).
  - Behavior: Similar to login page but calls globalThis.sdk.register() to initiate registration flow. Shows "Redirecting..." message.
  - Usage: Calls globalThis.sdk.register() in connectedCallback to start the registration flow.

- src/pages/callback.page.ts
  - Purpose: OAuth / OpenID Connect callback handler — identity provider returns here.
  - Behavior: Processes callback by calling globalThis.sdk.entry() to handle the authorization response. After successful token exchange, navigates to profile page.
  - Note: Keep this route unprotected so external providers can return here.
  - Usage: In connectedCallback, calls globalThis.sdk.entry() then uses router to navigate to /profile on success.

- src/pages/profile.page.ts
  - Purpose: Protected user profile page.
  - Behavior: Protected by router guard (enter hook in router config checks globalThis.sdk.isAuthenticated). Displays claims and token information.
  - Usage: Directly accesses globalThis.sdk.accessToken, globalThis.sdk.refreshToken, globalThis.sdk.idTokenClaims to display user data.

- src/pages/revoke.page.ts
  - Purpose: Revoke tokens or sessions (optional advanced session management).
  - Behavior: Calls globalThis.sdk.revoke() to invalidate tokens, surfaces success/error, then redirects to home.
  - Usage: In connectedCallback, calls globalThis.sdk.revoke() and handles the promise, navigating on completion.

- src/pages/logout.page.ts
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls globalThis.sdk.logout() which clears local storage and redirects to identity provider logout endpoint if configured.
  - Usage: In connectedCallback, calls globalThis.sdk.logout() to perform logout and clear session.
