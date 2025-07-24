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
