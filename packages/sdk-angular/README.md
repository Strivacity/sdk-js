# @strivacity/sdk-angular

> **The SDK supports Angular version 16 and above**

## Example Apps

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/angular)
- [Ionic Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/ionic-angular)

## Install

```bash
npm install @strivacity/sdk-angular
```

## Usage

### Add this to your application configuration

#### NgModule - Import `StrivacityAuthModule` to your application:

`app.module.ts`

```ts
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { StrivacityAuthModule } from '@strivacity/sdk-angular';

@NgModule({
	declarations: [AppComponent],
	imports: [
		...StrivacityAuthModule.forRoot({
			mode: 'redirect', // or 'popup' or 'native'
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
			mode: 'redirect', // or 'popup' or 'native'
			issuer: 'https://<YOUR_DOMAIN>',
			scopes: ['openid', 'profile'],
			clientId: '<YOUR_CLIENT_ID>',
			redirectUri: '<YOUR_REDIRECT_URI>',
		}),
	],
};
```

### How to use the SDK in your components

#### Redirect mode

When using redirect mode, the authentication flow involves two main components: a login page that initiates the authentication process, and a callback page that handles the response from the identity provider.

In **redirect mode**, users are redirected to the identity provider's login page in the same browser window. After successful authentication, they are redirected back to your application's callback URL.

##### Login page example

The login page is where users start the authentication process. This component automatically triggers the login flow when the page loads, redirecting users to the identity provider for authentication.

```html
<!-- login.component.html -->
<section>
	<h1>Redirecting...</h1>
</section>
```

```ts
// login.component.ts
import { Component, OnInit } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-login',
	templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
	constructor(private strivacityAuthService: StrivacityAuthService) {}

	ngOnInit(): void {
		this.strivacityAuthService.login().subscribe();
	}
}
```

##### Callback page example

The callback page handles the response from the identity provider after successful authentication. It processes the authentication result, extracts the tokens, and redirects users to their intended destination (typically a protected page like a profile or dashboard).

```html
<!-- callback.component.html -->
<section>
	@if (error) {
	<h1>Error in authentication</h1>
	<div>
		<h4>{{ error }}</h4>
		<p>{{ errorDescription }}</p>
	</div>
	} @else {
	<h1>Logging in...</h1>
	}
</section>
```

```ts
// callback.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-callback',
	templateUrl: './callback.component.html',
})
export class CallbackComponent implements OnInit, OnDestroy {
	private subscription = new Subscription();
	error: string | null = null;
	errorDescription: string | null = null;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private strivacityAuthService: StrivacityAuthService,
	) {}

	ngOnInit(): void {
		this.subscription.add(
			this.strivacityAuthService.handleCallback().subscribe({
				next: () => {
					this.router.navigateByUrl('/profile');
				},
				error: (err) => {
					this.error = this.route.snapshot.queryParamMap.get('error');
					this.errorDescription = this.route.snapshot.queryParamMap.get('error_description');
					console.error('Error during callback handling:', err);
				},
			}),
		);
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
```

##### Profile page example

The profile page displays user information and authentication details after successful login. It uses the `StrivacityAuthService` to access the authentication state and display relevant data such as access tokens, ID token claims, and expiration status.

We check if the user is authenticated and display their profile information. If the user is not authenticated, we redirect them to the login page.

```html
<!-- profile.component.html -->
<section>
	@if (session.loading) {
	<h1>Loading...</h1>
	} @else {
	<dl>
		<dt>
			<strong>accessToken</strong>
		</dt>
		<dd>
			<pre>{{ session.accessToken | json }}</pre>
		</dd>
		<dt>
			<strong>refreshToken</strong>
		</dt>
		<dd>
			<pre>{{ session.refreshToken | json }}</pre>
		</dd>
		<dt>
			<strong>accessTokenExpired</strong>
		</dt>
		<dd>
			<pre>{{ session.accessTokenExpired | json }}</pre>
		</dd>
		<dt>
			<strong>accessTokenExpirationDate</strong>
		</dt>
		<dd>
			<pre>{{ session.accessTokenExpirationDate | date: 'medium' }}</pre>
		</dd>
		<dt>
			<strong>claims</strong>
		</dt>
		<dd>
			<pre>{{ session.idTokenClaims | json }}</pre>
		</dd>
	</dl>
	}
</section>
```

```ts
// profile.component.ts
import { Component, OnDestroy } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Session, StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-profile',
	templateUrl: './profile.component.html',
	imports: [JsonPipe, DatePipe],
})
export class ProfileComponent implements OnDestroy {
	readonly subscription = new Subscription();
	session: Session = {
		loading: true,
		isAuthenticated: false,
		idTokenClaims: null,
		accessToken: null,
		refreshToken: null,
		accessTokenExpired: false,
		accessTokenExpirationDate: null,
	};

	constructor(private strivacityAuthService: StrivacityAuthService) {
		this.subscription.add(
			this.strivacityAuthService.session$.subscribe((session) => {
				this.session = session;
			}),
		);
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
```

##### Logout page example

The logout page handles user logout by terminating their session. The `postLogoutRedirectUri` parameter is optional and specifies where users should be redirected after logout. If not provided, users will be redirected to the identity provider's logout page.

This URI must be configured in the Admin Console as an allowed post-logout redirect URI for your application.

```html
<!-- logout.component.html -->
<section>
	<h1>Logging out...</h1>
</section>
```

```ts
// logout.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-logout',
	templateUrl: './logout.component.html',
})
export class LogoutComponent implements OnInit, OnDestroy {
	readonly subscription = new Subscription();

	constructor(
		private router: Router,
		private strivacityAuthService: StrivacityAuthService,
	) {}

	async ngOnInit(): Promise<void> {
		if (this.strivacityAuthService.isAuthenticated()) {
			await firstValueFrom(this.strivacityAuthService.logout({ postLogoutRedirectUri: window.location.origin }));
		} else {
			await this.router.navigateByUrl('/');
		}
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
```

##### Component example

Here's a simple component example that demonstrates how to use the SDK in a component with login/logout functionality:

```html
<!-- app.component.html -->
@if (isAuthenticated) {
<div>Welcome, {{ name }}!</div>
<button (click)="logout()">Logout</button>
} @else {
<div>Not logged in</div>
<button (click)="login()">Log in</button>
}
```

```ts
// app.component.ts
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy {
	private subscription = new Subscription();
	isAuthenticated = false;
	name = '';

	constructor(
		private router: Router,
		private strivacityAuthService: StrivacityAuthService,
	) {
		this.subscription.add(
			this.strivacityAuthService.session$.subscribe((session) => {
				this.isAuthenticated = session.isAuthenticated;
				this.name = `${session.idTokenClaims?.given_name} ${session.idTokenClaims?.family_name}`;
			}),
		);
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
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

#### Native mode

If you are using `native` mode, you can use the `sty-login-renderer` component to render the login UI.

To customize the UI components used in the authentication flows, define the `widgets` object in your component.

##### Example widgets

```ts
import {
	CheckboxWidget,
	DateWidget,
	InputWidget,
	LayoutWidget,
	MultiSelectWidget,
	PasscodeWidget,
	LoadingWidget,
	PasswordWidget,
	PhoneWidget,
	SelectWidget,
	StaticWidget,
	SubmitWidget,
} from './components/widgets';

export const widgets = {
	checkbox: CheckboxWidget,
	date: DateWidget,
	input: InputWidget,
	layout: LayoutWidget,
	loading: LoadingWidget,
	passcode: PasscodeWidget,
	password: PasswordWidget,
	phone: PhoneWidget,
	select: SelectWidget,
	multiSelect: MultiSelectWidget,
	static: StaticWidget,
	submit: SubmitWidget,
};
```

You can find example widgets here: [Example widgets](https://github.com/Strivacity/sdk-js/tree/main/apps/angular/src/app/components/widgets)

##### Login page example

The native mode login page provides a fully customizable authentication experience rendered directly within your application. Unlike redirect mode, native mode keeps users on your site throughout the entire authentication process using the `sty-login-renderer` component.

This example demonstrates how to handle session management, implement callback functions for various authentication events, and manage URL parameters for session continuity.

```html
<!-- login.component.html -->
<section>
	<sty-login-renderer
		[widgets]="widgets"
		[sessionId]="sessionId"
		(fallback)="onFallback($event)"
		(login)="onLogin()"
		(error)="onError($event)"
		(globalMessage)="onGlobalMessage($event)"
		(blockReady)="onBlockReady($event)"
	></sty-login-renderer>
</section>
```

```ts
// login.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityAuthService, FallbackError, StyLoginRenderer, LoginFlowState } from '@strivacity/sdk-angular';
import { widgets } from '@/components/widgets'; // Import your custom widgets

@Component({
	standalone: true,
	imports: [StyLoginRenderer],
	selector: 'app-login',
	templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
	readonly widgets = widgets;
	sessionId: string | null = null;

	constructor(
		private router: Router,
		private strivacityAuthService: StrivacityAuthService,
	) {}

	/**
	 * Extract session_id from URL parameters and clean up the URL
	 * This is necessary for maintaining session state across external login providers
	 */
	ngOnInit(): void {
		if (window.location.search !== '') {
			const url = new URL(window.location.href);
			this.sessionId = url.searchParams.get('session_id');
			url.search = '';
			history.replaceState({}, '', url.toString());
		}
	}

	/**
	 * Called when authentication is successful
	 * Redirects user to the profile page
	 */
	async onLogin(): Promise<void> {
		await this.router.navigateByUrl('/profile');
	}

	/**
	 * Called when native flow cannot handle the authentication
	 * Falls back to redirect mode by navigating to the provided URL
	 * @param error - FallbackError containing the fallback URL and message
	 */
	onFallback(error: FallbackError): void {
		if (error.url) {
			console.log(`Fallback: ${error.url}`);
			location.href = error.url.toString();
		} else {
			console.error(`FallbackError without URL: ${error.message}`);
			alert(error);
		}
	}

	/**
	 * Called when an error occurs during the authentication process
	 * @param error - Error message describing what went wrong
	 */
	onError(error: string): void {
		console.error(`Error: ${error}`);
		alert(error);
	}

	/**
	 * Called when the authentication flow wants to display a global message
	 * @param message - Message to display to the user
	 */
	onGlobalMessage(message: string): void {
		alert(message);
	}

	/**
	 * Called when the authentication flow transitions between states
	 * Useful for tracking flow progress and inject custom logic such as logging or analytics
	 * @param params - Object containing previous and current flow states
	 */
	onBlockReady({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }): void {
		console.log('previousState', previousState);
		console.log('state', state);
	}
}
```

##### Callback page example

The native mode callback page handles authentication responses when external identity providers redirect back to your application. This page checks for session IDs in the URL parameters and either continues the native flow or falls back to standard callback handling.

This component is essential for handling social login providers (like Google, Facebook, etc.) that require redirect-based authentication even within native mode flows.

```html
<!-- callback.component.html -->
<section>
	@if (error) {
	<h1>Error in authentication</h1>
	<div>
		<h4>{{ error }}</h4>
		<p>{{ errorDescription }}</p>
	</div>
	} @else {
	<h1>Logging in...</h1>
	}
</section>
```

```ts
// callback.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-callback',
	templateUrl: './callback.component.html',
})
export class CallbackComponent implements OnInit, OnDestroy {
	readonly subscription = new Subscription();
	error: string | null = null;
	errorDescription: string | null = null;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private strivacityAuthService: StrivacityAuthService,
	) {}

	ngOnInit(): void {
		const url = new URL(window.location.href);
		const sessionId = url.searchParams.get('session_id');

		if (sessionId) {
			this.router.navigate(['/login'], { queryParams: { session_id: sessionId } });
			return;
		}

		this.subscription.add(
			this.strivacityAuthService.handleCallback().subscribe({
				next: () => {
					this.router.navigateByUrl('/profile');
				},
				error: (err) => {
					this.error = this.route.snapshot.queryParamMap.get('error');
					this.errorDescription = this.route.snapshot.queryParamMap.get('error_description');
					console.error('Error during callback handling:', err);
				},
			}),
		);
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
```

##### Profile page example

Same as the profile page example in redirect mode.

##### Logout page example

Same as the logout page example in redirect mode.

## Logging

The SDK supports optional logging to help you debug authentication flows and monitor SDK behavior. You can enable the built-in console logger or provide your own custom logger implementation.

### Using the Default Logger

Enable the default console logger by adding the `logging` option when configuring the SDK:

#### NgModule Configuration

```typescript
import { NgModule } from '@angular/core';
import { StrivacityAuthModule } from '@strivacity/sdk-angular';
import { DefaultLogging } from '@strivacity/sdk-core';

@NgModule({
	declarations: [AppComponent],
	imports: [
		...StrivacityAuthModule.forRoot({
			mode: 'redirect',
			issuer: 'https://<YOUR_DOMAIN>',
			scopes: ['openid', 'profile'],
			clientId: '<YOUR_CLIENT_ID>',
			redirectUri: '<YOUR_REDIRECT_URI>',
			logging: DefaultLogging, // Enable built-in console logging
		}),
	],
	bootstrap: [AppComponent],
})
export class AppModule {}
```

#### Standalone Configuration

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideStrivacity } from '@strivacity/sdk-angular';
import { DefaultLogging } from '@strivacity/sdk-core';

export const appConfig: ApplicationConfig = {
	providers: [
		...provideStrivacity({
			mode: 'redirect',
			issuer: 'https://<YOUR_DOMAIN>',
			scopes: ['openid', 'profile'],
			clientId: '<YOUR_CLIENT_ID>',
			redirectUri: '<YOUR_REDIRECT_URI>',
			logging: DefaultLogging, // Enable built-in console logging
		}),
	],
};
```

The default logger writes to the browser console and automatically prefixes messages with a correlation ID when available (via the `xEventId` property).

### Creating a Custom Logger

You can provide your own logger by implementing the `SDKLogging` interface with four methods: `debug`, `info`, `warn`, and `error`. An optional `xEventId` property is honored for log correlation.

```typescript
import type { SDKLogging } from '@strivacity/sdk-angular';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		// Send to your logging pipeline
		console.debug(this.xEventId ? `[${this.xEventId}] ${message}` : message);
	}

	info(message: string): void {
		console.info(this.xEventId ? `[${this.xEventId}] ${message}` : message);
	}

	warn(message: string): void {
		console.warn(this.xEventId ? `[${this.xEventId}] ${message}` : message);
	}

	error(message: string, error: Error): void {
		console.error(this.xEventId ? `[${this.xEventId}] ${message}` : message, error);
	}
}
```

Then register your custom logger when configuring the SDK:

#### Standalone Configuration

```typescript
import { provideStrivacity } from '@strivacity/sdk-angular';
import { MyLogger } from './logging/MyLogger';

export const appConfig: ApplicationConfig = {
	providers: [
		...provideStrivacity({
			mode: 'redirect',
			issuer: 'https://<YOUR_DOMAIN>',
			scopes: ['openid', 'profile'],
			clientId: '<YOUR_CLIENT_ID>',
			redirectUri: '<YOUR_REDIRECT_URI>',
			logging: MyLogger, // Use your custom logger
		}),
	],
};
```

### Logger Interface

The `SDKLogging` interface requires the following methods:

- **`debug(message: string): void`** - Log debug-level messages
- **`info(message: string): void`** - Log informational messages
- **`warn(message: string): void`** - Log warning messages
- **`error(message: string, error: Error): void`** - Log error messages with error objects

The optional `xEventId` property, when set by the SDK, provides a correlation ID to trace related log messages across the authentication flow.

## API Documentation

#### `StrivacityAuthService`

Service that manages Strivacity authentication flows. Supports `PopupFlow`, `RedirectFlow`, or `NativeFlow` types.

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

**Methods**

- **`isAuthenticated()`**: Checks if the user is authenticated.

  ```typescript
  isAuthenticated(): Observable<boolean>;
  ```

- **`login(options?: LoginOptions)`**: Logs the user in using the specified options.

  ```typescript
  login(options?: LoginOptions): Observable<void>;
  ```

- **`register(options?: RegisterOptions)`**: Registers a new user using the specified options.

  ```typescript
  register(options?: RegisterOptions): Observable<void>;
  ```

- **`refresh()`**: Refreshes the current authentication session.

  ```typescript
  refresh(): Observable<void>;
  ```

- **`revoke()`**: Revokes the current session tokens.

  ```typescript
  revoke(): Observable<void>;
  ```

- **`logout(options?: LogoutOptions)`**: Logs the user out using the specified options.

  ```typescript
  logout(options?: LogoutOptions): Observable<void>;
  ```

- **`handleCallback(url?: string)`**: Handles the authentication callback (e.g., after a redirect flow).

  ```typescript
  handleCallback(url?: string): Observable<void>;
  ```

#### `StyLoginRenderer` component

The `StyLoginRenderer` component is used in native mode to render the authentication UI directly within your application. It provides a fully customizable login experience using your own UI components.

```typescript
StyLoginRenderer: Component<{
	params?: NativeParams;
	widgets?: PartialRecord<WidgetType, Component>;
	sessionId?: string | null;
	login?: EventEmitter<IdTokenClaims | null>;
	fallback?: EventEmitter<FallbackError>;
	error?: EventEmitter<any>;
	globalMessage?: EventEmitter<string>;
	blockReady?: EventEmitter<{ previousState: LoginFlowState; state: LoginFlowState }>;
}>;
```

**Properties**

- **`params?: NativeParams`** (optional): Additional parameters to pass to the native login flow. These parameters can include custom configuration options for the authentication process.

- **`widgets?: PartialRecord<WidgetType, Component>`** (optional): A collection of Angular components that define the UI widgets used in the authentication flow. Each widget type (input, button, layout, etc.) can be customized with your own components.

- **`sessionId?: string | null`** (optional): The session ID for continuing an existing authentication session. This is typically extracted from URL parameters when returning from external identity providers.

**Events**

- **`(login)?: EventEmitter<IdTokenClaims | null>`** (optional): Event emitted when authentication is successful. Receives the ID token claims as a parameter.

- **`(fallback)?: EventEmitter<FallbackError>`** (optional): Event emitted when the native flow cannot handle the authentication and needs to fall back to redirect mode. The error parameter contains the fallback URL.

- **`(error)?: EventEmitter<any>`** (optional): Event emitted when an error occurs during the authentication process. Use this to handle and display error messages to users.

- **`(globalMessage)?: EventEmitter<string>`** (optional): Event emitted when the authentication flow wants to display a global message to the user (e.g., account lockout warnings, validation messages).

- **`(blockReady)?: EventEmitter<{ previousState: LoginFlowState; state: LoginFlowState }>`** (optional): Event emitted when the authentication flow transitions between states. Useful for tracking progress, implementing custom logging, or injecting analytics. Receives both the previous and current flow states.

**Widget Types**

The `widgets` input accepts the following widget types:

- `checkbox`: For checkbox input fields
- `date`: For date input fields
- `input`: For text input fields
- `layout`: For layout containers and form structure
- `loading`: For loading indicators
- `multiSelect`: For multi-select dropdown fields
- `passcode`: For passcode input fields
- `password`: For password input fields
- `phone`: For phone number input fields
- `select`: For single-select dropdown fields
- `static`: For static text and display elements
- `submit`: For form submission buttons

Each widget component receives inputs specific to its type and function within the authentication flow.

## Links

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/angular)
