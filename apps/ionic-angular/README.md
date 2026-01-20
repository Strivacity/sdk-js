# Strivacity SDK - Ionic Angular Example App

This example application demonstrates how to integrate the Strivacity SDK into an Ionic Angular application with full mobile platform support using Capacitor plugins and native device capabilities.

## Ionic-Specific Enhancements

### Mobile Platform Support with Capacitor

This Ionic Angular application extends the standard Angular implementation with Capacitor plugins for mobile platform support:

#### 1. Additional Dependencies

The Ionic version includes additional Capacitor packages for mobile platform functionality (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-angular": "*",
	"@capacitor/app": "^7.0.1",
	"@capacitor/inappbrowser": "2.2.0",
	"@capacitor/preferences": "^7.0.1"
}
```

These packages provide:

- **@capacitor/app**: App lifecycle and state management for mobile platforms
- **@capacitor/inappbrowser**: In-app browser functionality for authentication flows
- **@capacitor/preferences**: Native storage capabilities for secure token management

#### 2. Enhanced App Configuration

The Ionic version includes Capacitor-specific storage and HTTP client implementations (see [src/app/app.config.ts](./src/app/app.config.ts)):

```typescript
import { Preferences } from '@capacitor/preferences';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { InAppBrowser } from '@capacitor/inappbrowser';

// Custom HTTP client for mobile platforms
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

// Native storage implementation
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
```

#### 2. Platform-Aware URL and Callback Handlers

The configuration includes platform detection for handling authentication flows differently on web vs mobile:

```typescript
provideStrivacity({
	// ...other config
	storage: Capacitor.getPlatform() === 'web' ? LocalStorage : CapacitorStorage,
	async urlHandler(url, responseMode) {
		if (Capacitor.getPlatform() === 'web') {
			return redirectUrlHandler(url, responseMode);
		} else {
			await InAppBrowser.openInWebView({ url, options: DefaultWebViewOptions });
		}
	},
	async callbackHandler(url, responseMode) {
		if (Capacitor.getPlatform() !== 'web') {
			// InAppBrowser navigation listener implementation
			return new Promise(async (resolve, reject) => {
				// Mobile-specific callback handling with navigation listeners
			});
		} else {
			return redirectCallbackHandler(url, responseMode);
		}
	},
});
```

### 3. Enhanced Authentication Pages

Both login and register pages include mobile-specific fallback handling:

#### Login Page Enhancements ([src/app/pages/login/login.page.ts](./src/app/pages/login/login.page.ts)):

```typescript
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler } from '@strivacity/sdk-core/utils/handlers';

async ngOnInit() {
	if (this.options?.mode === 'redirect') {
		this.subscription.add(
			this.strivacityAuthService.login().subscribe({
				next: async () => {
					// Mobile platform token exchange
					if (Capacitor.getPlatform() !== 'web') {
						const params = await this.options.callbackHandler!(
							this.options.redirectUri,
							this.options.responseMode || 'fragment'
						);
						await this.strivacityAuthService.sdk.tokenExchange(params);
						await this.router.navigateByUrl('/profile');
					}
				},
				error: (error: any) => this.onError(error),
			}),
		);
	}
}

async onFallback(error: FallbackError) {
	if (error.url) {
		if (Capacitor.getPlatform() === 'web') {
			return redirectUrlHandler(error.url.toString());
		} else {
			// InAppBrowser implementation for mobile platforms
			await InAppBrowser.openInWebView({
				url: error.url.toString(),
				options: DefaultWebViewOptions
			});

			const params = await new Promise<Record<string, string>>(async (resolve, reject) => {
				let navigationListener: PluginListenerHandle | null = null;
				let finishListener: PluginListenerHandle | null = null;
				let userCancelled = true;

				// Navigation event listeners for mobile authentication flow
				navigationListener = await InAppBrowser.addListener(
					'browserPageNavigationCompleted',
					async (event) => {
						// Handle redirect URI navigation
						if (event.url?.startsWith(this.options.redirectUri)) {
							// Extract and process authentication parameters
							userCancelled = false;
							await InAppBrowser.close();
							resolve(params);
						}
					}
				);

				finishListener = await InAppBrowser.addListener('browserClosed', async () => {
					if (userCancelled) {
						reject(new Error('InAppBrowser flow cancelled by user.'));
					}
				});
			});

			// Handle authentication result
			if (params.session_id) {
				await this.router.navigateByUrl(`/callback?session_id=${params.session_id}`);
			} else {
				await this.strivacityAuthService.sdk.tokenExchange(params);
				await this.router.navigateByUrl('/profile');
			}
		}
	}
}
```

#### Register Page Enhancements ([src/app/pages/register/register.page.ts](./src/app/pages/register/register.page.ts)):

The register page includes identical mobile platform enhancements with the same InAppBrowser handling and platform detection logic.

### 4. Key Differences from Standard Angular Implementation

| Feature                 | Standard Angular      | Ionic Angular                                                       |
| ----------------------- | --------------------- | ------------------------------------------------------------------- |
| **Storage**             | LocalStorage only     | Platform-aware: LocalStorage (web) / Capacitor Preferences (mobile) |
| **HTTP Client**         | Standard fetch        | Platform-aware: fetch (web) / CapacitorHttp (mobile)                |
| **Authentication Flow** | Web redirects only    | Platform-aware: redirects (web) / InAppBrowser (mobile)             |
| **URL Handling**        | Browser navigation    | Platform-aware: browser (web) / InAppBrowser (mobile)               |
| **Callback Handling**   | URL parameter parsing | Platform-aware: URL parsing (web) / navigation listeners (mobile)   |
| **Session Management**  | Browser-based         | Native device storage integration                                   |

### 5. Mobile Platform Features

- **Native Storage**: Uses Capacitor Preferences API for secure token storage on mobile devices
- **InAppBrowser Integration**: Handles authentication flows within the app context on mobile platforms
- **Platform Detection**: Automatically detects and adapts behavior for web, iOS, and Android platforms
- **Navigation Listeners**: Monitors InAppBrowser navigation events for authentication callback handling
- **User Cancellation Handling**: Properly handles user-initiated authentication flow cancellations
- **Session Management**: Platform-appropriate session handling with native capabilities

## Standard Angular Features

This example application demonstrates how to integrate the Strivacity SDK into an Angular application using standalone components, Angular's dependency injection system, and modern Angular patterns.

## Key Features and Implementation

### 1. Angular Dependencies

This Angular application uses the Strivacity Angular SDK for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-angular": "*"
}
```

### 2. Dependency Injection Integration

The application uses Angular's dependency injection system to provide the Strivacity SDK throughout the application (see [src/app/app.config.ts](./src/app/app.config.ts)):

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStrivacity } from '@strivacity/sdk-angular';

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
		}),
	],
};
```

### 3. Standalone Components

The application uses Angular's standalone components pattern for modern, modular architecture (see [src/app/app.component.ts](./src/app/app.component.ts)):

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { StrivacityService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [CommonModule, RouterOutlet, RouterLink],
	template: `
		<div>
			@if (strivacityService.loading()) {
				<div>Loading...</div>
			}
			@if (strivacityService.isAuthenticated()) {
				<div>Welcome, {{ userName() }}!</div>
			}
		</div>
	`,
})
export class AppComponent {
	strivacityService = inject(StrivacityService);

	userName = computed(() => {
		const claims = this.strivacityService.idTokenClaims();
		return `${claims?.given_name ?? ''} ${claims?.family_name ?? ''}`;
	});
}
```

### 4. Route Guards

The application implements Angular route guards for protecting authenticated routes (see [src/app/guards/auth.guard.ts](./src/app/guards/auth.guard.ts)):

```typescript
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { StrivacityService } from '@strivacity/sdk-angular';

export const authGuard: CanActivateFn = () => {
	const strivacityService = inject(StrivacityService);
	const router = inject(Router);

	if (strivacityService.isAuthenticated()) {
		return true;
	}

	router.navigate(['/login']);
	return false;
};
```

### 5. Reactive Patterns

The application leverages Angular's signals and reactive patterns for state management:

```typescript
import { Component, inject, computed } from '@angular/core';
import { StrivacityService } from '@strivacity/sdk-angular';

@Component({
	template: `
		@if (isLoading()) {
			<div>Loading...</div>
		} @else if (isAuthenticated()) {
			<div>Welcome back!</div>
		}
	`,
})
export class ProfileComponent {
	private strivacityService = inject(StrivacityService);

	isLoading = this.strivacityService.loading;
	isAuthenticated = this.strivacityService.isAuthenticated;
	userClaims = this.strivacityService.idTokenClaims;
}
```

### 6. Logging

You can enable SDK logging or plug in your own logger.

- Enable default logging by adding `logging: DefaultLogging` to the SDK configuration in [src/app/app.config.ts](./src/app/app.config.ts). The default logger writes to the browser console and automatically prefixes messages with an `xEventId` property when available

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideStrivacity } from '@strivacity/sdk-angular';
import { DefaultLogging } from '@strivacity/sdk-core';

export const appConfig: ApplicationConfig = {
	providers: [
		// ...other providers
		provideStrivacity({
			// ...other options
			logging: DefaultLogging, // enable built-in console logging
		}),
	],
};
```

- Provide a custom logger by implementing the `SDKLogging` interface (methods: `debug`, `info`, `warn`, `error`). An optional `xEventId` property is honored for log correlation. See the built-in implementation for reference in [packages/sdk-core/src/utils/Logging.ts](../../packages/sdk-core/src/utils/Logging.ts).

```ts
import type { SDKLogging } from '@strivacity/sdk-angular';

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

Then register your logger class in the SDK configuration:

```typescript
import { provideStrivacity } from '@strivacity/sdk-angular';
import { MyLogger } from './logging/MyLogger';

export const appConfig: ApplicationConfig = {
	providers: [
		// ...other providers
		provideStrivacity({
			// ...other options
			logging: MyLogger,
		}),
	],
};
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
VITE_REDIRECT_URI=http://localhost:4200/callback
VITE_MODE=redirect
```

### 3. Running the Application

#### Development Server

```bash
pnpm app:angular:serve
```

#### Production Build

```bash
pnpm run build
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is integrated through Angular's dependency injection system, making it available throughout the application as a service (see [src/app/app.config.ts](./src/app/app.config.ts)).

### Service Usage

Angular components can inject the `StrivacityService` to access authentication state and methods:

```typescript
import { Component, inject } from '@angular/core';
import { StrivacityService } from '@strivacity/sdk-angular';

@Component({
	template: `
		<button (click)="login()">Login</button>
		<button (click)="logout()">Logout</button>
	`,
})
export class AuthComponent {
	private strivacityService = inject(StrivacityService);

	login() {
		this.strivacityService.login();
	}

	logout() {
		this.strivacityService.logout();
	}
}
```

### Pages

Brief, purpose-oriented descriptions of route components under src/app/pages — what they do, expected behavior, and how they integrate mobile-aware flows (Capacitor / InAppBrowser) via the AuthService.

- src/app/pages/home/home.component.ts
  - Purpose: Landing / home page. Publicly accessible; introduces the app and links to login/register.
  - Behavior: Displays user info when authenticated via AuthService observables.
  - Usage: Inject AuthService and subscribe to isAuthenticated$, loading$, idTokenClaims$.

- src/app/pages/login/login.component.ts
  - Purpose: Login page / entry point for authentication flows.
  - Behavior: Calls AuthService.login() which may redirect or open InAppBrowser on mobile. For mobile, listen for InAppBrowser navigation events and forward callback params to AuthService for token exchange.
  - Usage: AuthService.login(); handle mobile fallback via Capacitor InAppBrowser and AuthService.handleCallback().

- src/app/pages/register/register.component.ts
  - Purpose: Registration page (if supported).
  - Behavior: Starts a registration flow or shows a form that calls backend/SDK to create a user. Mobile flows use InAppBrowser fallback like login.
  - Usage: AuthService.register() or custom form + AuthService calls.

- src/app/pages/entry/entry.component.ts
  - Purpose: Entry component for link-driven flows (deep links or external links) that start server/SDK-driven operations.
  - Behavior: On init call AuthService.entry(); if a session_id is returned navigate to /callback?session_id=... otherwise navigate to home. Show loading and error states.
  - Usage: AuthService.entry().subscribe(...) or await in async init.

- src/app/pages/callback/callback.component.ts
  - Purpose: OAuth / OpenID Connect callback handler — identity provider returns here.
  - Behavior: Reads query params (code, state, session_id) from ActivatedRoute. Finalizes authentication via AuthService.handleCallback(params) (token exchange or session resume) then navigate to intended route (e.g., /profile).
  - Note: Keep this route unguarded so external providers and InAppBrowser flows can return.

- src/app/pages/profile/profile.component.ts
  - Purpose: Protected user profile page.
  - Behavior: Guarded by an AuthGuard (canActivate) that consults AuthService.isAuthenticated$ (or resolver). Displays idTokenClaims and user data from AuthService.
  - Usage: Inject AuthService, show idTokenClaims$, provide logout button calling AuthService.logout().

- src/app/pages/revoke/revoke.component.ts
  - Purpose: Revoke tokens or sessions (advanced session management).
  - Behavior: Calls AuthService.revoke() or server endpoint to invalidate refresh tokens/sessions. Surface success/errors and optionally log out or redirect.
  - Usage: AuthService.revoke().subscribe(...); after successful revoke call AuthService.logout() / Router.navigate(['/']).

- src/app/pages/logout/logout.component.ts
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls AuthService.logout(), clears native storage (Capacitor Preferences) and navigates to home or login. Implement as an init action showing progress then redirect.
  - Tip: Run logout logic in ngOnInit() and show a spinner while redirecting.
