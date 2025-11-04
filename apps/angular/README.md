# Strivacity SDK - Angular Example App

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

## Pages

Brief, purpose-oriented descriptions of the components under src/app/pages — what they do, expected behavior, and how they use the StrivacityService.

- src/app/pages/home.component.ts

  - Purpose: Landing / home page. Publicly accessible; introduces the app and links to login/register.
  - Behavior: Shows public content and, when authenticated, brief user info from StrivacityService.idTokenClaims(). Should be accessible without auth.
  - Usage: const strivacity = inject(StrivacityService); use strivacity.loading, strivacity.isAuthenticated() and strivacity.idTokenClaims() (or signal accessors) for conditional UI.

- src/app/pages/login.component.ts

  - Purpose: Login page / entry point for authentication flows.
  - Behavior: Triggers the SDK login flow (redirect/popup depending on configuration). If already authenticated, typically navigate to /profile.
  - Usage: const strivacity = inject(StrivacityService); call strivacity.login(); check strivacity.isAuthenticated() and navigate when appropriate.

- src/app/pages/register.component.ts

  - Purpose: Registration page (if supported).
  - Behavior: Initiates a registration flow via the SDK or backend. On success either sign-in or navigate to login.
  - Usage: inject(StrivacityService) or use a form + backend call, then call login/redirect as needed.

- src/app/pages/entry.component.ts

  - Purpose: Entry page used by link-driven flows to start server/SDK-driven operations.
  - Behavior: Calls StrivacityService.entry(); if a session_id is returned, redirect to /callback?session_id=... otherwise fallback to home. Show loading and error states.
  - Usage: const strivacity = inject(StrivacityService); run entry() in an effect/ngOnInit and handle the returned session ID and errors.

- src/app/pages/callback.component.ts

  - Purpose: OAuth / OpenID Connect callback handler — identity provider returns here.
  - Behavior: Processes query params (code, state, session_id), completes authentication via the SDK, then redirects to the intended route (e.g., /profile).
  - Note: Keep this route unprotected so external providers can return to it.
  - Usage: inject(StrivacityService); call the SDK callback/redirect handler (e.g., handleRedirect or the appropriate method) in an effect, then Router.navigate() on success.

- src/app/pages/profile.component.ts

  - Purpose: Protected user profile page.
  - Behavior: Require authentication (route guard or component-level check). Displays idTokenClaims and other user data from StrivacityService; optionally fetch server data using the session.
  - Usage: const strivacity = inject(StrivacityService); use strivacity.idTokenClaims, provide a logout button that calls strivacity.logout().

- src/app/pages/revoke.component.ts

  - Purpose: Revoke tokens or sessions (optional advanced session management page).
  - Behavior: Calls SDK or backend revoke API to invalidate refresh tokens/sessions, surfaces success/error, then logs out or redirects.
  - Usage: inject(StrivacityService); call the SDK revoke method (if available) and then call logout/redirect on success.

- src/app/pages/logout.component.ts
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls StrivacityService.logout(), clears client-side state, and redirects to home or login. Implement as an effect that shows progress and navigates away.
  - Usage: const strivacity = inject(StrivacityService); perform logout in ngOnInit/effect and Router.navigate when complete.
