# Strivacity SDK - Angular Example App

This example application demonstrates how to integrate the [@strivacity/sdk-angular](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-angular) SDK into an Angular 19 application using standalone components and Angular Router. It covers all supported authentication modes (`redirect`, `popup`, `native`, `embedded`) and shows how to structure route-based authentication flows.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

The SDK is registered via `provideStrivacity()` in `app.config.ts` and exposes the `StrivacityAuthService`, which is injected into standalone components using Angular's dependency injection. Angular Router is used for client-side navigation with route-based authentication guards.

## Requirements

- Angular: 19+
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
pnpm app:angular:serve
```

## Usage

### Initialization

The SDK is registered as an Angular provider in `src/app/app.config.ts` using `provideStrivacity()`. All environment variables are read from the Vite environment and passed directly. The app also dynamically imports `bundle.js` from the configured issuer domain, which registers the Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`, etc.) used in `embedded` mode:

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStrivacity, DefaultLogging } from '@strivacity/sdk-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(routes),
		provideStrivacity({
			mode: import.meta.env.VITE_MODE,
			issuer: import.meta.env.VITE_ISSUER,
			scopes: import.meta.env.VITE_SCOPES.split(' '),
			clientId: import.meta.env.VITE_CLIENT_ID,
			redirectUri: import.meta.env.VITE_REDIRECT_URI,
			storageTokenName: 'sty.session.angular',
			logging: DefaultLogging,
		}),
	],
};
```

Components access authentication state by injecting `StrivacityAuthService`. The service exposes Angular Signals for `loading`, `isAuthenticated`, `idTokenClaims`, and other state properties:

```typescript
import { Component, SkipSelf, computed } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({ standalone: true, selector: 'app-home', templateUrl: './home.page.html' })
export class HomeComponent {
	loading = this.authService.loading;
	isAuthenticated = this.authService.isAuthenticated;
	userName = computed(() => this.authService.idTokenClaims()?.given_name ?? '');

	constructor(@SkipSelf() protected authService: StrivacityAuthService) {}
}
```

### Login / Register

`src/app/pages/login/login.page.ts` and `src/app/pages/register/register.page.ts` initiate the authentication flow. The active mode determines how the UI is rendered:

- **`redirect`** — `login()` is called on init; the user is taken to the identity provider in the same window.
- **`popup`** — `login()` is called on init; authentication happens in a popup window.
- **`native`** — The `StyLoginRenderer` component renders the login UI inline using your custom widget components.
- **`embedded`** — The `<sty-login>` web component (loaded via `bundle.js` from the cluster) takes over rendering.

`src/app/pages/callback/callback.page.ts` handles the response from the identity provider. It calls `handleCallback()` and navigates to `/profile` on success:

```typescript
import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({ standalone: true, selector: 'app-callback-page', templateUrl: './callback.page.html' })
export class CallbackPage {
	readonly subscription = new Subscription();

	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService,
	) {}

	ngOnInit(): void {
		const url = new URL(location.href);

		if (url.searchParams.has('session_id')) {
			void this.router.navigate(['/login'], { queryParams: url.searchParams });
			return;
		}

		this.subscription.add(
			this.strivacityAuthService.handleCallback().subscribe({
				next: () => void this.router.navigateByUrl('/profile'),
				error: (err) => console.error('Error during callback handling:', err),
			}),
		);
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
```

### Refresh token

Token refresh runs automatically when the SDK detects an expired access token. The `refresh` method is also available on the service for manual invocation:

```typescript
import { Component, SkipSelf } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({ standalone: true, selector: 'app-profile', templateUrl: './profile.page.html' })
export class ProfilePage {
	constructor(@SkipSelf() protected authService: StrivacityAuthService) {}

	refresh() {
		this.authService.refresh().subscribe();
	}
}
```

### Revoke session / logout

`src/app/pages/revoke/revoke.page.ts` revokes the current session tokens without a full logout. It calls `revoke()` and then navigates to the home page:

```typescript
import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({ standalone: true, selector: 'app-revoke-page', templateUrl: './revoke.page.html' })
export class RevokePage {
	readonly subscription = new Subscription();

	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService,
	) {}

	ngOnInit(): void {
		this.strivacityAuthService.revoke().subscribe({
			next: () => void this.router.navigateByUrl('/'),
		});
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
```

`src/app/pages/logout/logout.page.ts` performs a full logout. When the user is authenticated, `logout()` is called with `postLogoutRedirectUri` set to the application origin; otherwise the user is immediately redirected home:

```typescript
import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({ standalone: true, selector: 'app-logout-page', templateUrl: './logout.page.html' })
export class LogoutPage {
	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService,
	) {}

	async ngOnInit(): Promise<void> {
		if (this.strivacityAuthService.isAuthenticated()) {
			await firstValueFrom(this.strivacityAuthService.logout({ postLogoutRedirectUri: window.location.origin }));
		} else {
			void this.router.navigateByUrl('/');
		}
	}
}
```

### Resume an externally-initiated flow

`src/app/pages/entry/entry.page.ts` handles flows started by an external process (e.g. password reset, magic link, invite). On init it calls `entry()`, which processes the incoming URL and returns a `session_id` (and optionally a `short_app_id`). These are forwarded as query parameters to `/callback` to resume the flow; if no data is returned the user is redirected to the home page:

```typescript
import { Component, SkipSelf } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({ standalone: true, selector: 'app-entry-page', templateUrl: './entry.page.html' })
export class EntryPage {
	constructor(
		protected router: Router,
		@SkipSelf() protected strivacityAuthService: StrivacityAuthService,
	) {}

	ngOnInit() {
		this.strivacityAuthService.entry().subscribe({
			next: (data) => {
				if (data && Object.keys(data).length > 0) {
					void this.router.navigate(['/callback'], { queryParams: new URLSearchParams(data) });
				} else {
					void this.router.navigate(['/']);
				}
			},
			error: (error) => {
				alert(error);
				void this.router.navigate(['/']);
			},
		});
	}
}
```

The callback page detects the `session_id` parameter and forwards it to `/login` to continue the native or embedded flow, instead of running the standard `handleCallback()` path.

The login page extracts `session_id`, `short_app_id`, and `language` from the URL on load, cleans up the URL, and passes them to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new login. When a `language` parameter is present it is passed to the renderer via `[language]`; the resolved language is emitted back via `(languageChange)`.

You can also navigate directly to `/login?session_id=<id>` to resume a flow without going through the entry page, which is useful when the `session_id` is obtained through your own backend logic.

## Logging

Enable the built-in console logger by passing `logging: DefaultLogging` to the SDK options:

```typescript
import { provideStrivacity, DefaultLogging } from '@strivacity/sdk-angular';

provideStrivacity({
	// ...other options
	logging: DefaultLogging,
});
```

The default logger writes to the browser console and prefixes messages with the `xEventId` correlation ID when available.

To use a custom logger, implement the `SDKLogging` interface and register your class in the SDK options:

```typescript
import type { SDKLogging } from '@strivacity/sdk-angular';

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
import { provideStrivacity } from '@strivacity/sdk-angular';
import { MyLogger } from './logging/MyLogger';

provideStrivacity({
	// ...other options
	logging: MyLogger,
});
```

## Pages

| Page     | Path                                      | Description                                                                                                                                                                                                                                                                                                       |
| -------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home     | `src/app/pages/home/home.page.ts`         | Public landing page. Displays user info when authenticated.                                                                                                                                                                                                                                                       |
| Login    | `src/app/pages/login/login.page.ts`       | Entry point for the authentication flow. Accepts optional `session_id` and `short_app_id` URL parameters to resume an existing flow instead of starting a new one. An optional `language` URL parameter is passed to the renderer via `[language]`; the resolved language is emitted back via `(languageChange)`. |
| Register | `src/app/pages/register/register.page.ts` | Entry point for the registration flow. Mirrors the login page structure with an extra `prompt: create` parameter. Also accepts an optional `language` URL parameter, passed to the renderer in the same way.                                                                                                      |
| Callback | `src/app/pages/callback/callback.page.ts` | Handles the identity provider's redirect response. Routes to the login page when a `session_id` is present, otherwise completes the standard authorization flow.                                                                                                                                                  |
| Entry    | `src/app/pages/entry/entry.page.ts`       | Entry point for externally-initiated flows (e.g. password reset). Processes the incoming URL and routes to the appropriate next step.                                                                                                                                                                             |
| Profile  | `src/app/pages/profile/profile.page.ts`   | Protected page showing the authenticated user's session details and token information.                                                                                                                                                                                                                            |
| Revoke   | `src/app/pages/revoke/revoke.page.ts`     | Invalidates the current session tokens without a full logout and returns the user to the home page.                                                                                                                                                                                                               |
| Logout   | `src/app/pages/logout/logout.page.ts`     | Terminates the user's session and redirects to the home page after logout.                                                                                                                                                                                                                                        |

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This example app is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
