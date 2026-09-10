# @strivacity/sdk-angular

Angular SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication to your Angular application. Ships with a client SDK and a backend-for-frontend ([BFF](../../README.md#bff)) Server SDK that mounts as an Express router - no separate backend required.

Built on top of [@strivacity/sdk-core](../sdk-core) - see the [core SDK documentation](../sdk-core/README.md) for detailed information about authentication flows, configuration options, and advanced features.

**See also:**
- [Full Documentation](https://docs.strivacity.com/reference/overview) - Complete guide for all authentication modes
- [Example App](../../apps/angular) - Working Angular example covering both client-managed and server-managed sessions
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
  - [Services API](#services-api)
    - [StrivacityAuthService](#strivacityauthservice)
    - [StrivacityNativeLoginService](#strivacitynativeloginservice)
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

- Angular 20+
- Express 5+ for server-managed sessions (optional peer dependency)
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-angular
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
import type { SDKInitConfig } from '@strivacity/sdk-angular';

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

Only needed for server-managed sessions - skip this step (and step 3's router) if you're using client-managed sessions.

```ts
// src/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { sdkOptions } from '../options';

export const serverSdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // http-only cookie encryption key (random 32+ characters)
	postLoginRedirectUri: '/profile',
});
```

### 3. Mount the Express router

`sdk.handlers` is an Express `Router` exposing every auth route - mount it under `authUrlPrefix` in your SSR server entry, ahead of Angular's own request handler:

```ts
// src/server/server.ts
import express from 'express';
import { AngularNodeAppEngine, writeResponseToNodeResponse } from '@angular/ssr/node';
import { sdkOptions } from '../options';
import { serverSdk } from './strivacity';

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(sdkOptions.authUrlPrefix!, serverSdk.handlers);

app.use((req, res, next) => {
	angularApp
		.handle(req)
		.then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
		.catch(next);
});
```

Also hydrate the session into Angular's `TransferState` before the app renders, so the client can pick it up without an extra round-trip - add this to your server-only `ApplicationConfig`:

```ts
// src/server/app.config.server.ts
import { type ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/ssr';
import { provideStrivacityServerSession } from '@strivacity/sdk-angular/server';
import { appConfig } from '../app/app.config';
import { serverSdk } from './strivacity';

const serverConfig: ApplicationConfig = {
	providers: [provideServerRendering(), provideStrivacityServerSession(serverSdk)],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
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

### 4. Provide the SDK

```ts
// src/app/app.config.ts
import type { ApplicationConfig } from '@angular/core';
import { provideStrivacity } from '@strivacity/sdk-angular';
import { sdkOptions } from '../options';

export const appConfig: ApplicationConfig = {
	providers: [provideStrivacity(sdkOptions)],
};
```

For server-managed sessions, nothing else is needed here - `StrivacityAuthService`'s constructor automatically reads the session that `provideStrivacityServerSession` (see step 3) seeded into Angular's `TransferState`, so there's no manual session prop to pass through.

> Still bootstrapping via `NgModule`? `StrivacityAuthModule.forRoot(sdkOptions)` is the module-based equivalent of `provideStrivacity(sdkOptions)`.

---

## Client SDK

### Authentication modes

The `mode` set in `src/options.ts` (see [Quick start](#quick-start)) controls which of the four flows below is active - the DI setup shown in the [core SDK docs](../sdk-core/README.md#choosing-a-mode) is already handled by `provideStrivacity()`, so the examples below start directly from the page component level.

#### redirect mode

> For details on how this mode works, see the [hosted journey documentation](https://docs.strivacity.com/reference/hosted-journey).

The current browser tab navigates to the Strivacity-hosted login page and back to the configured `redirectUri` after authentication.

##### Login

**Client-managed sessions**:

Call this to start the login flow. It redirects the user to the Strivacity login page in the current browser tab, where they authenticate.

```ts
// src/app/pages/login/login.page.ts
import { Component, type OnInit, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-login-page',
	template: `
		<section>
			<h1>Redirecting to login...</h1>
		</section>
	`,
})
export class LoginPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);

	ngOnInit(): void {
		void this.authService.login({
			// Optional parameters
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
		});
	}
}
```

**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/login` - the Express router from [Quick start](#quick-start) intercepts the request and the Server SDK builds the authorization request and redirects to the IDP:

```ts
// src/app/pages/login/login.page.ts
import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
	selector: 'app-login-page',
	template: '',
})
export class LoginPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			globalThis.location.href = '/auth/login';
		} else if (this.responseInit) {
			// Issues a real HTTP 302 during SSR; RESPONSE_INIT is null during CSR/build
			this.responseInit.status = 302;
			this.responseInit.headers = new Headers({ Location: '/auth/login' });
		}
	}
}
```

##### Handle the callback

**Client-managed sessions**:

Call this on your redirect URI route after the IDP sends the user back. It parses the query parameters from the callback URL, verifies the state matches what was stored during login (CSRF protection), exchanges the authorization code for tokens using PKCE, validates the ID token, and stores the session in the [configured storage](../sdk-core/README.md#storages).

```ts
// src/app/pages/callback/callback.page.ts
import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-callback-page',
	template: `
		<section>
			<h1>Logging in...</h1>
		</section>
	`,
})
export class CallbackPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			void this.handleCallback();
		}
	}

	private async handleCallback(): Promise<void> {
		const params = this.route.snapshot.queryParams;

		if (params['error'] || params['error_description']) {
			await this.router.navigate(['/error'], { queryParams: params });
			return;
		}

		try {
			await this.authService.handleCallback();
			await this.router.navigateByUrl('/profile');
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
```

**Server-managed sessions**:

Forward the callback query string to `/auth/callback` - the Server SDK completes the code exchange and redirects to `postLoginRedirectUri`:

```ts
// src/app/pages/callback/callback.page.ts
import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'app-callback-page',
	template: `
		<section>
			<h1>Logging in...</h1>
		</section>
	`,
})
export class CallbackPage implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		const query = new URLSearchParams(this.route.snapshot.queryParams as Record<string, string>).toString();
		const url = `/auth/callback${query ? `?${query}` : ''}`;

		if (isPlatformBrowser(this.platformId)) {
			globalThis.location.href = url;
		} else if (this.responseInit) {
			this.responseInit.status = 302;
			this.responseInit.headers = new Headers({ Location: url });
		}
	}
}
```

##### Registration

**Client-managed sessions**:

Call this to start the registration flow. It works the same way as `login()` but opens the registration form instead.

```ts
// src/app/pages/register/register.page.ts
import { Component, type OnInit, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-register-page',
	template: `
		<section>
			<h1>Redirecting to registration...</h1>
		</section>
	`,
})
export class RegisterPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);

	ngOnInit(): void {
		void this.authService.register({
			loginHint: 'user@example.com',
		});
	}
}
```

**Server-managed sessions**:

Skip the client SDK entirely and redirect straight to `/auth/register` - the Server SDK builds the registration request and redirects to the IDP:

```ts
// src/app/pages/register/register.page.ts
import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
	selector: 'app-register-page',
	template: '',
})
export class RegisterPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			globalThis.location.href = '/auth/register';
		} else if (this.responseInit) {
			this.responseInit.status = 302;
			this.responseInit.headers = new Headers({ Location: '/auth/register' });
		}
	}
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```ts
// src/app/pages/logout/logout.page.ts
import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export class LogoutPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			void this.authService.logout();
		}
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```ts
// src/app/pages/logout/logout.page.ts
import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export class LogoutPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			globalThis.location.href = '/auth/logout';
		} else if (this.responseInit) {
			this.responseInit.status = 302;
			this.responseInit.headers = new Headers({ Location: '/auth/logout' });
		}
	}
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```ts
import '@strivacity/common/components/token-field';
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-token-panel',
	template: `
		@if (!authService.loading()) {
			<div>
				<button (click)="onRefresh()">Refresh</button>
				<button (click)="onRevoke()">Revoke</button>
				<pre>{{ { idTokenClaims: authService.idTokenClaims(), accessToken: authService.accessToken(), refreshToken: authService.refreshToken() } | json }}</pre>
			</div>
		}
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TokenPanelComponent {
	readonly authService = inject(StrivacityAuthService);

	async onRefresh(): Promise<void> {
		// Refresh the access token using the refresh token
		await this.authService.refresh();
	}

	async onRevoke(): Promise<void> {
		// Revoke all tokens at the authorization server and clear the local session
		await this.authService.revoke();
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the router redirect back:

```ts
function onRefresh() {
	// sdk.refreshSession() runs server-side, then redirects back to returnTo
	globalThis.location.href = '/auth/refresh?returnTo=/profile';
}

function onRevoke() {
	// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
	globalThis.location.href = '/auth/revoke';
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

```ts
// src/app/pages/login/login.page.ts
import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import type { PopupFlow } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-login-page',
	template: `
		<section>
			<h1>Opening login popup...</h1>
		</section>
	`,
})
export class LoginPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		void this.startLogin();
	}

	private async startLogin(): Promise<void> {
		try {
			await (this.authService.sdk as PopupFlow).login({
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
			await this.router.navigateByUrl('/profile');
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
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

```ts
// src/app/pages/register/register.page.ts
import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import type { PopupFlow } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-register-page',
	template: `
		<section>
			<h1>Opening registration popup...</h1>
		</section>
	`,
})
export class RegisterPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		void this.startRegister();
	}

	private async startRegister(): Promise<void> {
		try {
			await (this.authService.sdk as PopupFlow).register({
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
			await this.router.navigateByUrl('/profile');
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
```

**Server-managed sessions**:

Popup mode always needs client-side JavaScript to open the window, so there's no server-only alternative here.

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```ts
// src/app/pages/logout/logout.page.ts
import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export class LogoutPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			void this.authService.logout();
		}
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```ts
// src/app/pages/logout/logout.page.ts
import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export class LogoutPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			globalThis.location.href = '/auth/logout';
		} else if (this.responseInit) {
			this.responseInit.status = 302;
			this.responseInit.headers = new Headers({ Location: '/auth/logout' });
		}
	}
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```ts
import '@strivacity/common/components/token-field';
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-token-panel',
	template: `
		@if (!authService.loading()) {
			<div>
				<button (click)="onRefresh()">Refresh</button>
				<button (click)="onRevoke()">Revoke</button>
				<pre>{{ { idTokenClaims: authService.idTokenClaims(), accessToken: authService.accessToken(), refreshToken: authService.refreshToken() } | json }}</pre>
			</div>
		}
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TokenPanelComponent {
	readonly authService = inject(StrivacityAuthService);

	async onRefresh(): Promise<void> {
		// Refresh the access token using the refresh token
		await this.authService.refresh();
	}

	async onRevoke(): Promise<void> {
		// Revoke all tokens at the authorization server and clear the local session
		await this.authService.revoke();
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the router redirect back:

```ts
function onRefresh() {
	// sdk.refreshSession() runs server-side, then redirects back to returnTo
	globalThis.location.href = '/auth/refresh?returnTo=/profile';
}

function onRevoke() {
	// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
	globalThis.location.href = '/auth/revoke';
}
```

---

#### embedded mode

> For details on how this mode works, see the [embedded journey documentation](https://docs.strivacity.com/reference/embedded-journey).

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`). The component bundle isn't an npm package - load it dynamically from your Strivacity tenant cluster once, on the login route. Angular binds non-string inputs (like `params`) as properties via `[...]` and wires up custom events via `(...)`, so there's no manual ref/listener wiring needed for the basic case - just remember to add `schemas: [CUSTOM_ELEMENTS_SCHEMA]` to the component:

##### Login / Register

**Client-managed sessions**:

```ts
// src/app/pages/login/login.page.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { injectScript, StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-login-page',
	template: `
		<section>
			<sty-notifications></sty-notifications>
			<sty-login [params]="params" [sessionId]="sessionId" [shortAppId]="shortAppId" [lang]="language" (login)="onLogin()" (close)="onClose()" (error)="onError($event)"></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly platformId = inject(PLATFORM_ID);

	readonly params = {
		loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
		acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
		audiences: ['https://api.example.com'], // target resources for the access token
		language: 'en-US', // set the UI language (BCP 47 language tag)
		prompt: 'login', // use 'create' to open the registration flow instead
	};

	// Optional: Resume a session started from an entry URL (e.g., password reset)
	readonly sessionId = this.route.snapshot.queryParamMap.get('session_id');
	readonly shortAppId = this.route.snapshot.queryParamMap.get('short_app_id');
	readonly language = this.route.snapshot.queryParamMap.get('language') ?? (isPlatformBrowser(this.platformId) ? globalThis.navigator.language : 'en-US');

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
		// custom element definitions from the auth server
		injectScript('sty-components', `${this.authService.sdk.options.issuer}/assets/components/bundle.js`);
	}

	onLogin(): void {
		void this.router.navigateByUrl('/profile');
	}

	onClose(): void {
		globalThis.location.reload();
	}

	onError(event: Event): void {
		void this.router.navigate(['/error'], { queryParams: { message: (event as CustomEvent<string>).detail } });
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - the `<sty-login>` component's internal requests are transparently proxied through `/auth/login`/`/auth/register` instead of going straight to the IDP.

##### Controlling when the flow starts

By default the login flow starts automatically as soon as `<sty-login>` connects to the DOM. Add the `lazy` attribute to take manual control, then call `start()` when ready. `start()` accepts an optional params object forwarded to the authorization request, or you can set params via the `params` property before calling it:

```ts
// src/app/pages/login/login.page.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, type AfterViewInit, ElementRef, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import type { LoginComponent } from '@strivacity/sdk-angular/types';

@Component({
	selector: 'app-login-page',
	template: `
		<section>
			<sty-notifications></sty-notifications>
			<button (click)="onStartClick()">Continue to login</button>
			<sty-login #loginEl lazy (login)="onLogin()"></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage {
	private readonly router = inject(Router);

	readonly loginEl = viewChild.required<ElementRef<LoginComponent>>('loginEl');

	async onStartClick(): Promise<void> {
		await this.loginEl().nativeElement.start({
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			language: 'en-US', // set the UI language (BCP 47 language tag)
			prompt: 'login', // use 'create' to open the registration flow instead
		});
	}

	onLogin(): void {
		void this.router.navigateByUrl('/profile');
	}
}
```

You can also set params via the `params` property before calling `start()`:

```ts
// src/app/pages/login/login.page.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, viewChild } from '@angular/core';
import type { LoginComponent } from '@strivacity/sdk-angular/types';

@Component({
	selector: 'app-login-page',
	template: `
		<sty-login #loginEl lazy></sty-login>
		<button (click)="onStartClick()">Start Login</button>
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage {
	readonly loginEl = viewChild.required<ElementRef<LoginComponent>>('loginEl');

	async onStartClick(): Promise<void> {
		const element = this.loginEl().nativeElement;

		element.params = {
			loginHint: 'user@example.com', // identifier or JWT-encoded data to hint the login flow
			acrValues: ['urn:strivacity:loa:2'], // request specific authentication context
			audiences: ['https://api.example.com'], // target resources for the access token
			language: 'en-US', // set the UI language (BCP 47 language tag)
			prompt: 'login', // use 'create' to open the registration flow instead
		};
		await element.start();
	}
}
```

##### Login events

The `<sty-login>` element dispatches `login`, `close`, and `error` custom events - bind them the same way as `(login)`/`(close)`/`(error)` shown above. If you need to attach/detach listeners manually instead (e.g. conditionally), grab the element via `viewChild` and use `addEventListener` in `ngAfterViewInit`/`ngOnDestroy`:

```ts
// src/app/pages/login/login.page.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, type AfterViewInit, type OnDestroy, ElementRef, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import type { LoginComponent } from '@strivacity/sdk-angular/types';

@Component({
	selector: 'app-login-page',
	template: `
		<section>
			<sty-notifications></sty-notifications>
			<sty-login #loginEl></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage implements AfterViewInit, OnDestroy {
	private readonly router = inject(Router);

	readonly loginEl = viewChild.required<ElementRef<LoginComponent>>('loginEl');

	private onLogin = () => {
		// User authenticated - navigate to a protected page
		void this.router.navigateByUrl('/profile');
	};
	private onClose = () => {
		// User cancelled or closed the login flow
		globalThis.location.reload();
	};
	private onError = (event: Event) => {
		// A fatal error occurred - the message is available in event.detail
		void this.router.navigate(['/error'], { queryParams: { message: (event as CustomEvent<string>).detail } });
	};

	ngAfterViewInit(): void {
		const element = this.loginEl().nativeElement;

		element.addEventListener('login', this.onLogin);
		element.addEventListener('close', this.onClose);
		element.addEventListener('error', this.onError);
	}

	ngOnDestroy(): void {
		const element = this.loginEl().nativeElement;

		element.removeEventListener('login', this.onLogin);
		element.removeEventListener('close', this.onClose);
		element.removeEventListener('error', this.onError);
	}
}
```

##### Notification events

The components dispatch `notification` events on the `document` that the `<sty-notifications>` component automatically displays. If you don't want to use `<sty-notifications>`, you can listen to these events and handle them yourself:

```ts
import { Component, type OnDestroy, type OnInit } from '@angular/core';

@Component({ selector: 'app-custom-notifications', template: '' })
export class CustomNotificationsComponent implements OnInit, OnDestroy {
	private onNotification(event: Event): void {
		const customEvent = event as CustomEvent;

		if (customEvent.detail.action === 'show') {
			// Add new notification to your custom notification system
			console.log('New notification:', customEvent.detail.notification);
		} else if (customEvent.detail.action === 'clear') {
			console.log('Clear all notifications');
		}
	}

	ngOnInit(): void {
		document.addEventListener('notification', this.onNotification);
	}

	ngOnDestroy(): void {
		document.removeEventListener('notification', this.onNotification);
	}
}
```

##### Dynamic language switching

The `<sty-language-selector>` component provides a built-in UI for language switching. If you don't want to use it, you can change the UI language dynamically by updating the `lang` property on the `<sty-login>` component:

```ts
import { Component } from '@angular/core';

@Component({
	selector: 'app-language-switcher',
	template: `
		<section>
			<div>
				<button (click)="currentLang = 'en-US'">English</button>
				<button (click)="currentLang = 'fr-FR'">Français</button>
				<button (click)="currentLang = 'de-DE'">Deutsch</button>
			</div>
			<sty-login [lang]="currentLang"></sty-login>
		</section>
	`,
})
export class LanguageSwitcherComponent {
	currentLang = 'en-US';
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

```ts
// src/app/pages/entry/entry.page.ts
import { Component, type OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import type { EmbeddedFlow } from '@strivacity/sdk-angular/types';
@Component({
	selector: 'app-entry-page',
	template: `
		<section>
			<h1>Loading...</h1>
		</section>
	`,
})
export class EntryPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);

	ngOnInit(): void {
		void this.handleEntry();
	}

	private async handleEntry(): Promise<void> {
		try {
			const data = await (this.authService.sdk as EmbeddedFlow).entry();
			// Redirect to login route with flow parameters
			const params = new URLSearchParams({
				session_id: data.session_id,
				short_app_id: data.short_app_id,
				language: data.language,
			});
			globalThis.location.href = `/login?${params}`;
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
```

Then on your login route, read the parameters and pass them to `<sty-login>`:

```ts
// src/app/pages/login/login.page.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
	selector: 'app-login-page',
	template: `
		<section>
			<sty-notifications></sty-notifications>
			<sty-login [sessionId]="sessionId" [shortAppId]="shortAppId" [lang]="language" (login)="onLogin()" (error)="onError($event)"></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage {
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	// Read parameters from URL
	readonly sessionId = this.route.snapshot.queryParamMap.get('session_id');
	readonly shortAppId = this.route.snapshot.queryParamMap.get('short_app_id');
	readonly language = this.route.snapshot.queryParamMap.get('language');

	onLogin(): void {
		void this.router.navigateByUrl('/profile');
	}

	onError(event: Event): void {
		void this.router.navigate(['/error'], { queryParams: { message: (event as CustomEvent<string>).detail } });
	}
}
```

**Option 2: Render login on the entry route**

Pass the parameters directly to `<sty-login>` on the same route:

```ts
// src/app/pages/entry/entry.page.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, type OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import type { EmbeddedFlow } from '@strivacity/sdk-angular/types';

@Component({
	selector: 'app-entry-page',
	template: `
		@if (sessionId(); as sessionId) {
			<section>
				<sty-notifications></sty-notifications>
				<sty-login [sessionId]="sessionId" [shortAppId]="shortAppId()" [lang]="language()" (login)="onLogin()" (error)="onError($event)"></sty-login>
				<sty-language-selector></sty-language-selector>
			</section>
		} @else {
			<section>
				<h1>Loading...</h1>
			</section>
		}
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EntryPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);

	readonly sessionId = signal<string | null>(null);
	readonly shortAppId = signal<string | null>(null);
	readonly language = signal<string | null>(null);

	ngOnInit(): void {
		void this.handleEntry();
	}

	private async handleEntry(): Promise<void> {
		try {
			const data = await (this.authService.sdk as EmbeddedFlow).entry();
			// Set signals for sty-login component
			this.sessionId.set(data.session_id);
			this.shortAppId.set(data.short_app_id);
			this.language.set(data.language);
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}

	onLogin(): void {
		void this.router.navigateByUrl('/profile');
	}

	onError(event: Event): void {
		void this.router.navigate(['/error'], { queryParams: { message: (event as CustomEvent<string>).detail } });
	}
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```ts
// src/app/pages/logout/logout.page.ts
import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export class LogoutPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			void this.authService.logout();
		}
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```ts
// src/app/pages/logout/logout.page.ts
import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export class LogoutPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			globalThis.location.href = '/auth/logout';
		} else if (this.responseInit) {
			this.responseInit.status = 302;
			this.responseInit.headers = new Headers({ Location: '/auth/logout' });
		}
	}
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```ts
import '@strivacity/common/components/token-field';
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-token-panel',
	template: `
		@if (!authService.loading()) {
			<div>
				<button (click)="onRefresh()">Refresh</button>
				<button (click)="onRevoke()">Revoke</button>
				<pre>{{ { idTokenClaims: authService.idTokenClaims(), accessToken: authService.accessToken(), refreshToken: authService.refreshToken() } | json }}</pre>
			</div>
		}
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TokenPanelComponent {
	readonly authService = inject(StrivacityAuthService);

	async onRefresh(): Promise<void> {
		// Refresh the access token using the refresh token
		await this.authService.refresh();
	}

	async onRevoke(): Promise<void> {
		// Revoke all tokens at the authorization server and clear the local session
		await this.authService.revoke();
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the router redirect back:

```ts
function onRefresh() {
	// sdk.refreshSession() runs server-side, then redirects back to returnTo
	globalThis.location.href = '/auth/refresh?returnTo=/profile';
}

function onRevoke() {
	// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
	globalThis.location.href = '/auth/revoke';
}
```

---

#### native mode

> For details on how this mode works, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey).

You build the entire login UI with your own components. `StrivacityNativeLoginService` drives a "headless" auth flow: instead of redirecting to a hosted page, the SDK returns a JSON description of the current screen that you render yourself, submit each form step with `submitForm()`, and repeat until the flow finalizes automatically.

> `StrivacityNativeLoginService` must be provided per-component (`providers: [StrivacityNativeLoginService]`), and `start(options)` must be called explicitly (e.g. from `ngOnInit`) - it doesn't start automatically like `StrivacityAuthService` does.
>
> The example below shows a simplified custom implementation. For a complete native renderer with all widget types, see the [example app](../../apps/angular/src/app/components/auth/native/native-login.ts).

##### Login / Register

**Client-managed sessions**:

```ts
// src/app/pages/login/login.page.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, type OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-login-page',
	template: `
		@if (nativeLoginService.loading() || !nativeLoginService.state().screen) {
			<section>
				<h1>Loading...</h1>
			</section>
		} @else if (nativeLoginService.state().screen === 'identifier') {
			<section>
				<h2>Sign In</h2>
				<form (submit)="onSubmitIdentifier($event)">
					<input
						type="text"
						placeholder="Email"
						[value]="nativeLoginService.forms()['identifier']?.['identifier'] ?? ''"
						(input)="nativeLoginService.setFormValue('identifier', 'identifier', $any($event.target).value)"
					/>
					@if (nativeLoginService.messages()['identifier']?.['identifier']; as message) {
						<div class="error">{{ message.text }}</div>
					}
					<button type="submit">Continue</button>
				</form>
			</section>
		} @else if (nativeLoginService.state().screen === 'password') {
			<section>
				<h2>Enter Password</h2>
				<form (submit)="onSubmitPassword($event)">
					<input
						type="password"
						placeholder="Password"
						[value]="nativeLoginService.forms()['password']?.['password'] ?? ''"
						(input)="nativeLoginService.setFormValue('password', 'password', $any($event.target).value)"
					/>
					@if (nativeLoginService.messages()['password']?.['password']; as message) {
						<div class="error">{{ message.text }}</div>
					}
					<button type="submit">Sign In</button>
				</form>
			</section>
		}
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	providers: [StrivacityNativeLoginService],
})
export class LoginPage implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	ngOnInit(): void {
		void this.nativeLoginService.start({
			params: {
				prompt: 'login', // use 'create' to open the registration flow instead
				language: 'en-US', // set the UI language (BCP 47 language tag)
				sdk: 'web-minimal', // rendering mode: 'web-minimal' for simplified rendering, 'web' (default) for full rendering hints and branding
				sessionId: this.route.snapshot.queryParamMap.get('session_id'), // pass a session ID to resume an existing flow
			},
			onLogin: async () => {
				await this.router.navigateByUrl('/profile');
			},
			onClose: () => {
				globalThis.location.reload();
			},
			onError: async (error) => {
				await this.router.navigate(['/error'], { queryParams: { message: error.message } });
			},
			onFallback: (error) => {
				// Fallback to hosted journey if native widget not supported
				globalThis.location.href = error.url.toString();
			},
			onGlobalMessage: (message) => {
				alert(message.text);
			},
		});
	}

	async onSubmitIdentifier(event: Event): Promise<void> {
		event.preventDefault();
		await this.nativeLoginService.submitForm('identifier');
	}

	async onSubmitPassword(event: Event): Promise<void> {
		event.preventDefault();
		await this.nativeLoginService.submitForm('password');
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured the code above is unchanged - `StrivacityNativeLoginService`'s internal requests are transparently proxied through your server instead of going straight to the IDP.

##### Handle the callback

**Client-managed sessions**:

No separate callback route is needed. Once `state().finalizeUrl` is set, `submitForm()` automatically finalizes the session internally to exchange the authorization code for tokens and store it.

**Server-managed sessions**:

Same as client managed - finalizing the session also transparently proxies through your server, with no separate route needed either way.

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), the user lands on the entry URL you configured in your Strivacity application native client settings. Call `entry()` on that landing route to resolve the flow parameters from the IDP (`session_id`, `short_app_id`, `language`).

You have two options:

**Option 1: Redirect to a separate login route**

```ts
// src/app/pages/entry/entry.page.ts
import { Component, type OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import type { NativeFlow } from '@strivacity/sdk-angular/types';

@Component({
	selector: 'app-entry-page',
	template: `
		<section>
			<h1>Loading...</h1>
		</section>
	`,
})
export class EntryPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);

	ngOnInit(): void {
		void this.handleEntry();
	}

	private async handleEntry(): Promise<void> {
		try {
			const data = await (this.authService.sdk as NativeFlow).entry();
			const params = new URLSearchParams({
				session_id: data.session_id,
				short_app_id: data.short_app_id,
				language: data.language,
			});
			globalThis.location.href = `/login?${params}`;
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
```

Then on your login route, read query parameters from the URL and pass it to `StrivacityNativeLoginService` to resume the flow, exactly as shown in the Login / Register example above:

```ts
// src/app/pages/login/login.page.ts
import { Component, type OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-login-page',
	template: '', // ...render based on `nativeLoginService.state().screen` as shown in the Login / Register example above
	providers: [StrivacityNativeLoginService],
})
export class LoginPage implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);
	private readonly route = inject(ActivatedRoute);

	ngOnInit(): void {
		void this.nativeLoginService.start({
			params: {
				sessionId: this.route.snapshot.queryParamMap.get('session_id'),
				language: this.route.snapshot.queryParamMap.get('language'),
			},
			onLogin: async () => {
				globalThis.location.href = '/profile';
			},
		});
	}
}
```

**Option 2: Render login on the entry route**

Call `StrivacityNativeLoginService.start()` directly from `entry.page.ts`, feeding it the `session_id` resolved from `entry()` - no redirect needed:

```ts
// src/app/pages/entry/entry.page.ts
import { Component, type OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityAuthService, StrivacityNativeLoginService } from '@strivacity/sdk-angular';
import type { NativeFlow } from '@strivacity/sdk-angular/types';

@Component({
	selector: 'app-entry-page',
	template: `
		@if (nativeLoginService.loading() || !nativeLoginService.state().screen) {
			<section>
				<h1>Loading...</h1>
			</section>
		}
		<!-- ...render based on `nativeLoginService.state().screen` as shown in the Login / Register example above -->
	`,
	providers: [StrivacityNativeLoginService],
})
export class EntryPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	readonly nativeLoginService = inject(StrivacityNativeLoginService);
	private readonly router = inject(Router);

	ngOnInit(): void {
		void this.handleEntry();
	}

	private async handleEntry(): Promise<void> {
		try {
			const data = await (this.authService.sdk as NativeFlow).entry();

			void this.nativeLoginService.start({
				params: { sessionId: data.session_id, language: data.language },
				onLogin: async () => {
					await this.router.navigateByUrl('/profile');
				},
				onError: async (error) => {
					await this.router.navigate(['/error'], { queryParams: { message: error.message } });
				},
			});
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { message: error instanceof Error ? error.message : 'Unknown error' } });
		}
	}
}
```

##### Logout

**Client-managed sessions**:

Call this to clear the session and redirect to the Strivacity end-session endpoint. After that the user is redirected back to your app at `postLogoutRedirectUri`.

```ts
// src/app/pages/logout/logout.page.ts
import { Component, type OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export class LogoutPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly platformId = inject(PLATFORM_ID);

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			void this.authService.logout();
		}
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, redirect to `/auth/logout` instead - the Server SDK clears the session and redirects to the IDP end-session endpoint:

```ts
// src/app/pages/logout/logout.page.ts
import { Component, type OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
	selector: 'app-logout-page',
	template: `
		<section>
			<h1>Logging out...</h1>
		</section>
	`,
})
export class LogoutPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			globalThis.location.href = '/auth/logout';
		} else if (this.responseInit) {
			this.responseInit.status = 302;
			this.responseInit.headers = new Headers({ Location: '/auth/logout' });
		}
	}
}
```

##### Token management

**Client-managed sessions**:

Call these methods to manage the session and access token client-side.

```ts
import '@strivacity/common/components/token-field';
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-token-panel',
	template: `
		@if (!authService.loading()) {
			<div>
				<button (click)="onRefresh()">Refresh</button>
				<button (click)="onRevoke()">Revoke</button>
				<pre>{{ { idTokenClaims: authService.idTokenClaims(), accessToken: authService.accessToken(), refreshToken: authService.refreshToken() } | json }}</pre>
			</div>
		}
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TokenPanelComponent {
	readonly authService = inject(StrivacityAuthService);

	async onRefresh(): Promise<void> {
		// Refresh the access token using the refresh token
		await this.authService.refresh();
	}

	async onRevoke(): Promise<void> {
		// Revoke all tokens at the authorization server and clear the local session
		await this.authService.revoke();
	}
}
```

**Server-managed sessions**:

With `serverSessionUri` configured, tokens are refreshed/revoked by the Server SDK - trigger it by navigating to the auth routes, then let the router redirect back:

```ts
function onRefresh() {
	// sdk.refreshSession() runs server-side, then redirects back to returnTo
	globalThis.location.href = '/auth/refresh?returnTo=/profile';
}

function onRevoke() {
	// sdk.revokeSession() runs server-side, then redirects to postLogoutRedirectUri
	globalThis.location.href = '/auth/revoke';
}
```

---

### Services API

#### StrivacityAuthService

The main service for accessing the SDK instance and reactive session state. Provided via `provideStrivacity()`/`StrivacityAuthModule.forRoot()` (see [Quick start](#quick-start)) - just `inject()` it wherever you need it.

```ts
import { Component, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({ /* ... */ })
export class SomeComponent {
	private readonly authService = inject(StrivacityAuthService);
}
```

##### Members

```ts
{
	// SDK instance (access any SDK method)
	readonly sdk: RedirectFlow | PopupFlow | EmbeddedFlow | NativeFlow;

	// Reactive state (signals - call them, e.g. `authService.loading()`; templates re-render when they change)
	readonly loading: Signal<boolean>; // True during initialization
	readonly language: Signal<string>; // Current BCP 47 language code
	readonly isAuthenticated: Signal<boolean>; // True if user has valid session
	readonly idTokenClaims: Signal<IdTokenClaims | null>; // Decoded ID token claims
	readonly accessToken: Signal<string | null>; // Current access token
	readonly refreshToken: Signal<string | null>; // Current refresh token
	readonly accessTokenExpired: Signal<boolean>; // True once the access token has expired
	readonly accessTokenExpirationDate: Signal<number | null>; // Access token expiration timestamp

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

#### StrivacityNativeLoginService

Service for managing native login flow state. Only available in `native` mode. Unlike `StrivacityAuthService`, it must be provided per-component (`providers: [StrivacityNativeLoginService]` on the component that owns the flow) and started explicitly by calling `start(options)` (e.g. from `ngOnInit`) - see [native mode](#native-mode) above.

```ts
import { Component, type OnInit, inject } from '@angular/core';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({ /* ... */ providers: [StrivacityNativeLoginService] })
export class SomeComponent implements OnInit {
	private readonly nativeLoginService = inject(StrivacityNativeLoginService);

	ngOnInit(): void {
		void this.nativeLoginService.start({
			params: { /* login params */ },
			onLogin: (session) => { /* handle login */ },
			onError: (error) => { /* handle error */ },
			// ... other callbacks
		});
	}
}
```

##### start() options

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

##### Members

```ts
{
	// Reactive state (signals - call them, e.g. `nativeLoginService.loading()`; templates re-render when they change)
	loading: Signal<boolean>; // True while fetching next screen
	state: Signal<Partial<NativeFlowState>>; // Current flow state (screen, forms, layout, etc.)
	forms: Signal<Record<string, Record<string, unknown>>>; // Form data by form ID
	messages: Signal<Record<string, Record<string, NativeFlowMessage>>>; // Validation messages

	// Methods
	start(options?: NativeLoginOptions): Promise<void>; // Start the native login flow - see options above
	submitForm(formId: string, customBody?: Record<string, unknown>): Promise<void>; // Submit a form and advance to next screen
	setFormValue(formId: string, widgetId: string, value: unknown): void; // Update a single field value before submission
	setMessage(formId: string, widgetId: string, value: NativeFlowMessage): void; // Set a validation/info message on a widget
	triggerFallback(message?: string): void; // Manually trigger fallback to hosted journey
	triggerClose(): void; // Signal that the login flow was closed by the user
}
```

---

## Server SDK

This is the same backend-for-frontend ([BFF](../../README.md#bff)) server implementation as the [core Server SDK](../sdk-core/README.md#server-sdk), pre-wired for Angular: `createServerSDK` provides an Express-based `ServerAdapter` and a default encrypted-cookie storage.

### Setup

```ts
// src/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { sdkOptions } from '../options';

export const serverSdk = createServerSDK({
	...sdkOptions,
	secret: process.env.SECRET, // required unless you provide a custom `storage`
	postLoginRedirectUri: '/profile',
});
```

Mount the Express router once - see [Quick start](#quick-start) for the full `server.ts`/`app.config.server.ts` wiring:

```ts
// src/server/server.ts
import express from 'express';
import { sdkOptions } from '../options';
import { serverSdk } from './strivacity';

const app = express();

app.use(sdkOptions.authUrlPrefix!, serverSdk.handlers);
```

### Accessing the session server-side

Call `getSession(req)` from any Express route handler, or from `provideStrivacityServerSession()`'s own `provideAppInitializer` (already wired up in [Quick start](#quick-start)), to read the current session without going through the client SDK:

```ts
// src/server/session.ts
import { serverSdk } from './strivacity';

app.get('/api/me', async (req, res) => {
	const session = await serverSdk.getSession(req);
	res.json({ claims: session?.claims });
});
```

Angular's own `REQUEST` token (populated by `@angular/ssr` during SSR) works the same way - `provideStrivacityServerSession()` (see [Quick start](#quick-start)) already uses it to hydrate `TransferState` before the app renders:

```ts
import { REQUEST, inject } from '@angular/core';
import { serverSdk } from './strivacity';

const session = await serverSdk.getSession(inject(REQUEST) ?? undefined);
```

<a id="server-storages"></a>
### Storages

By default the Server SDK stores tokens encrypted in http-only cookies and login state in a global in-memory `Map`. Provide `storage`/`stateStorage` to use something else.

#### Built-in session storages

- **`createEncryptedCookieStorage(secret, options?)`** - default storage that keeps the session encrypted in an http-only cookie.
- **`createSessionIdCookieStorage(storage, options?)`** - puts only a small, random session-id cookie on the client and keeps the actual session payload in the `storage` you provide. This supports back-channel logout out of the box.

```ts
// src/server/storage.ts
import { createSessionIdCookieStorage, createServerMemoryStorage } from '@strivacity/sdk-angular';

export const sessionStorage = createSessionIdCookieStorage(
	createServerMemoryStorage(),
	{
		// maxAge: 30 * 24 * 60 * 60 // Without maxAge this is a browser-session cookie that gets cleared when the browser closes
	},
);
```

```ts
// src/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { sdkOptions } from '../options';
import { sessionStorage } from './storage';

export const serverSdk = createServerSDK({
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
import type { AngularServerStorage, SDKStorage } from '@strivacity/sdk-angular/server';

const unstorageInstance = createStorage({ driver: redisDriver({ url: process.env.REDIS_URL }) });

// Custom session storage for tokens
export const sessionStorage: AngularServerStorage = {
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
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { sdkOptions } from '../options';
import { sessionStorage, stateStorage } from './storage';

export const serverSdk = createServerSDK({
	...sdkOptions,
	storage: sessionStorage, // Custom Redis-backed session storage
	stateStorage, // Custom Redis-backed state storage
});
```

> For more details on the storage interfaces, see the core SDK's [Custom storage](../sdk-core/README.md#server-storages) section.

### Back-channel logout

OIDC back-channel logout lets the authorization server terminate sessions server-to-server, without involving the browser. When the IDP sends a logout event (e.g. an admin terminates a session, or the user logs out from a different device), it POSTs a signed `logout_token` JWT to `/auth/backchannel-logout` - already wired up by the Express router from [Setup](#setup) - which routes it to `sdk.handleBackChannelLogout(req)`.

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

	// Angular-specific
	readonly handlers: Router; // the Express router exposing the auth endpoints; see Setup
}
```

### Server configuration reference

The Server SDK accepts the same configuration as the client SDK (see [Configuration reference](#configuration-reference)), plus:

| Option | Type | Required | Default | Description |
| ------ | ---- | -------- | ------- | ----------- |
| `secret` | `string` | Only if using default storage | - | Encryption key (32+ random characters) for the http-only cookie session storage |
| `storage` | `AngularServerStorage` | No | Encrypted cookie storage | Custom session storage; see [Storages](#server-storages) |
| `stateStorage` | `SDKStorage` | No | In-memory `Map` | Custom OAuth2 state storage |
| `authUrlPrefix` | `string` | No | `'/auth'` | URL prefix matched by `sdk.handlers` |
| `loginUri` | `string` | No | `'/login'` | Route your own [route guard](#route-guards) redirects to when there's no session |
| `postLoginRedirectUri` | `string` | No | - | Default redirect after login when no `?returnTo=` is given |
| `postLogoutRedirectUri` | `string` | No | - | Default redirect after logout |
| `cookieMaxAge` | `number` | No | `2592000` (30 days) | Max age of the session cookie in seconds |

---

## Route guards

This SDK doesn't ship a route-guard helper - use a plain Angular `CanActivateFn` with `StrivacityAuthService` and `RedirectCommand`. The same guard works both for client-side navigation (the Router performs the redirect) and during SSR (`RedirectCommand` produces a genuine HTTP redirect via Angular's SSR pipeline) - there's no separate client/server variant to write:

```ts
// src/app/guards/auth.guard.ts
import type { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

export const authGuard: CanActivateFn = async () => {
	const authService = inject(StrivacityAuthService);
	const router = inject(Router);

	await authService.init();

	if (await authService.sdk.isAuthenticated) {
		return true;
	}

	return new RedirectCommand(router.parseUrl('/login'));
};
```

```ts
// src/app/app.routes.ts
import type { Routes } from '@angular/router';
import { ProfilePage } from './pages/profile';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [{ path: 'profile', component: ProfilePage, canActivate: [authGuard] }];
```

---

## Shared features

The Angular SDK is built on top of the core SDK and supports all its features, on both the client and server:

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

v4 replaces the SDK's class-based flow architecture with function-based architecture, and adds a first-class Server SDK for server-managed (BFF) sessions. `StrivacityAuthService`, `provideStrivacity()`, and the built-in `redirect`/`popup`/`embedded`/`native` modes are unchanged - only apps that used `mode: 'custom'` or drove `native` mode through the old `NativeFlowHandler` need to update their code.

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

This is a low-level `@strivacity/sdk-core` primitive - it's used the same way no matter which framework package you build on top of it. Wire it up by adding `factory: createCustomFlow` to the `sdkOptions` object passed to `provideStrivacity()` - see [Custom flow](../sdk-core/README.md#custom-flow) in the core SDK README for the full pattern and usage example.

#### Server-managed sessions ([BFF](../../README.md#bff)) are now built in

In v3, routing authentication through your own backend meant writing a custom flow class like the one above yourself: manually calling `fetch()` against hand-written endpoints, and reimplementing PKCE/state handling, CSRF protection, and server-side token storage on your own.

v4 replaces that with the Server SDK shown in [Quick start](#quick-start) above: add `serverSessionUri` to your shared `sdkOptions`, create the server side with `createServerSDK` from `@strivacity/sdk-angular/server`, and mount its `handlers` Express router - PKCE, state, and session storage are all handled by the Server SDK:

```ts
// src/server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { sdkOptions } from '../options';

export const serverSdk = createServerSDK({
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

v4 moves `startSession()`, `submitForm()`, and `finalizeSession()` directly onto the flow itself - in `@strivacity/sdk-angular` this is wrapped for you by [`StrivacityNativeLoginService`](#strivacitynativeloginservice):

```ts
import { Component, inject } from '@angular/core';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

// v4
@Component({ /* ... */ providers: [StrivacityNativeLoginService] })
export class LoginPage {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	async ngOnInit() {
		await this.nativeLoginService.start({ sessionId });
	}
}
```

Update any code that calls `login()`/`register()` and drives the returned handler in `native` mode to use `StrivacityNativeLoginService` instead.

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
