# @strivacity/sdk-angular

> **The SDK supports Angular version 16 and above**

### Install

```bash
npm install @strivacity/sdk-angular
```

### Usage

#### NgModule - Import `StrivacityAuthModule` to your application:

`app.module.ts`

```ts
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { StrivacityAuthModule } from '@strivacity/angular-sdk';

@NgModule({
	declarations: [AppComponent],
	imports: [
		...StrivacityAuthModule.forRoot({
			issuer: 'https://<YOUR_DOMAIN>',
			scopes: ['openid', 'profile'],
			clientId: '<YOUR_CLIENT_ID>',
			redirectUri: '<YOUR_REDIRECT_URI>',
		}),
	],
	bootstrap: [AppComponent],
})
export class AppModule {}
```

#### Standalone mode - Configure SDK for your application:

`app.config.ts`

```ts
import { ApplicationConfig } from '@angular/core';
import { provideStrivacity } from '@strivacity/sdk-angular';

export const appConfig: ApplicationConfig = {
	providers: [
		...provideStrivacity({
			issuer: 'https://<YOUR_DOMAIN>',
			scopes: ['openid', 'profile'],
			clientId: '<YOUR_CLIENT_ID>',
			redirectUri: '<YOUR_REDIRECT_URI>',
		}),
	],
};
```

#### NgModule - How to use the SDK in your components:

`app.component.html`

```text
@if (isAuthenticated) {
	<div>Welcome, {{ name }}!</div>
	<button @click="logout()">Logout</button>
} @else {
	<div>Not logged in</div>
	<button @click="login()">Log in</button>
}
```

`app.component.ts`

```ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss'],
})
export class AppComponent {
	isAuthenticated = false;
	name = '';

	constructor(
		protected router: Router,
		protected strivacityAuthService: StrivacityAuthService,
	) {
		this.strivacityAuthService.session$.subscribe((session) => {
			this.isAuthenticated = session.isAuthenticated;
			this.name = `${session.idTokenClaims?.given_name} ${session.idTokenClaims?.family_name}`;
		});
	}

	login(): void {
		this.strivacityAuthService.login().subscribe({
			next: () => {
				this.router.navigateByUrl('/profile');
			},
		});
	}

	logout(): void {
		this.strivacityAuthService.logout().subscribe({
			next: () => {
				this.router.navigateByUrl('/');
			},
		});
	}
}
```

#### Standalone mode - How to use the SDK in your components:

Everything in the SDK are standalone, so you can use them by directly importing them to your components.

### API Documentation

#### `StrivacityAuthService`

Service that manages Strivacity authentication flows. Supports either `PopupFlow` or `RedirectFlow` types.

**Constructor**

```typescript
constructor(@Inject(STRIVACITY_SDK) public options: Options);
```

- `options`: SDK configuration options.

**Properties**

- **`session$`**: An observable that emits the current authentication session state. It provides updates on the authentication status, token information, and other relevant session details.

**Session Object Structure**:

```typescript
interface Session = {
	/**
	 * Indicates whether the session is in the process of loading or initializing.
	 * When `true`, the session information might not be fully available yet.
	 */
	loading: boolean;

	/**
	 * Indicates whether the user is currently authenticated.
	 * `true` if the user is authenticated, otherwise `false`.
	 */
	isAuthenticated: boolean;

	/**
	 * The claims contained in the ID token if the user is authenticated.
	 * This includes information such as the user's identity and authentication context.
	 * If the user is not authenticated, this will be `null`.
	 */
	idTokenClaims: IdTokenClaims | null;

	/**
	 * The current access token used for authorizing API requests.
	 * This token is `null` if the user is not authenticated or if the token has not been set.
	 */
	accessToken: string | null;

	/**
	 * The current refresh token used to obtain a new access token when the current one expires.
	 * This token is `null` if the user is not authenticated or if the token has not been set.
	 */
	refreshToken: string | null;

	/**
	 * Indicates whether the current access token has expired.
	 * `true` if the token is expired, otherwise `false`.
	 */
	accessTokenExpired: boolean;

	/**
	 * The expiration date of the current access token in Unix time (milliseconds since epoch).
	 * If the access token is not available or the session is not authenticated, this will be `null`.
	 */
	accessTokenExpirationDate: number | null;
};
```

**Emits**:

- **Initial State**: When the service is initialized, `session$` will emit an initial state with `loading: true` and other properties set to default or `null` values.
- **State Changes**: As authentication events occur (e.g., login, logout, token refresh), `session$` will emit updated session states reflecting the current authentication status and token details.

**Methods**

- **`isAuthenticated()`**: Checks if the user is authenticated.

  ```typescript
  isAuthenticated(): Observable<boolean>;
  ```

- **`login(options?: Parameters<Flow['login']>[0])`**: Logs the user in using the specified options.

  ```typescript
  login(options?: Parameters<Flow['login']>[0]): Observable<void>;
  ```

- **`register(options?: Parameters<Flow['register']>[0])`**: Registers a new user using the specified options.

  ```typescript
  register(options?: Parameters<Flow['register']>[0]): Observable<void>;
  ```

- **`refresh()`**: Refreshes the current authentication session.

  ```typescript
  refresh(): Observable<void>;
  ```

- **`revoke()`**: Revokes the current session tokens.

  ```typescript
  revoke(): Observable<void>;
  ```

- **`logout(options?: Parameters<Flow['logout']>[0])`**: Logs the user out using the specified options.

  ```typescript
  logout(options?: Parameters<Flow['logout']>[0]): Observable<void>;
  ```

- **`handleCallback(url?: Parameters<Flow['handleCallback']>[0])`**: Handles the authentication callback (e.g., after a redirect or popup flow).

  ```typescript
  handleCallback(url?: Parameters<Flow['handleCallback']>[0]): Observable<void>;
  ```

### Links

[Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/angular)
