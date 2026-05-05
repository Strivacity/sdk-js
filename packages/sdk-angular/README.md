# @strivacity/sdk-angular

An Angular library that integrates Strivacity's policy-driven authentication journeys into your application using the OAuth 2.0 PKCE flow. Supports `redirect`, `popup`, `native`, and `embedded` modes.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

This SDK allows you to integrate Strivacity's policy-driven journeys into your Angular application. It wraps the `@strivacity/sdk-core` library as an Angular service and provides `StrivacityAuthModule` for NgModule apps and `provideStrivacity()` for standalone apps. The SDK uses the OAuth 2.0 PKCE flow to authenticate with Strivacity. For detailed configuration options, available modes, and advanced usage refer to the [`@strivacity/sdk-core` documentation](https://github.com/Strivacity/sdk-js/blob/main/packages/sdk-core/README.md).

## Demo Application

- [Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/angular)
- [Ionic Example app](https://github.com/Strivacity/sdk-js/tree/main/apps/ionic-angular)

## Requirements

- Angular: 17+

## Install

```bash
npm install @strivacity/sdk-angular
```

## Usage

### Initialization

#### NgModule apps

Import `StrivacityAuthModule` in your `AppModule`:

```ts
// app.module.ts
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { StrivacityAuthModule } from '@strivacity/sdk-angular';

@NgModule({
	declarations: [AppComponent],
	imports: [
		...StrivacityAuthModule.forRoot({
			mode: 'redirect', // or 'popup', 'native', 'embedded'
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

#### Standalone apps

Use `provideStrivacity()` in your application config:

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideStrivacity } from '@strivacity/sdk-angular';

export const appConfig: ApplicationConfig = {
	providers: [
		...provideStrivacity({
			mode: 'redirect', // or 'popup', 'native', 'embedded'
			issuer: 'https://<YOUR_DOMAIN>',
			scopes: ['openid', 'profile'],
			clientId: '<YOUR_CLIENT_ID>',
			redirectUri: '<YOUR_REDIRECT_URI>',
		}),
	],
};
```

Inject `StrivacityAuthService` into any component to access authentication state:

```ts
import { Component } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({ standalone: true, selector: 'app-root', template: '' })
export class AppComponent {
	constructor(private strivacityAuthService: StrivacityAuthService) {}
}
```

### Redirect / Popup mode

In `redirect` mode the user is taken to the identity provider in the same window; in `popup` mode authentication happens in a popup. Both are initiated the same way from code.

#### Login page example

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

#### Callback page example

The callback page handles the response from the identity provider. It calls `handleCallback()` and redirects to `/profile` on success:

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

#### Profile page example

```html
<!-- profile.component.html -->
<section>
	@if (session.loading) {
	<h1>Loading...</h1>
	} @else {
	<dl>
		<dt><strong>accessToken</strong></dt>
		<dd><pre>{{ session.accessToken | json }}</pre></dd>
		<dt><strong>refreshToken</strong></dt>
		<dd><pre>{{ session.refreshToken | json }}</pre></dd>
		<dt><strong>accessTokenExpired</strong></dt>
		<dd><pre>{{ session.accessTokenExpired | json }}</pre></dd>
		<dt><strong>accessTokenExpirationDate</strong></dt>
		<dd><pre>{{ session.accessTokenExpirationDate | date: 'medium' }}</pre></dd>
		<dt><strong>claims</strong></dt>
		<dd><pre>{{ session.idTokenClaims | json }}</pre></dd>
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

#### Logout page example

The `postLogoutRedirectUri` parameter is optional and specifies where users are redirected after logout. This URI must be configured in the Admin Console as an allowed post-logout redirect URI.

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

#### Component example

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

	constructor(private strivacityAuthService: StrivacityAuthService) {
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
		this.strivacityAuthService.login().subscribe();
	}

	logout(): void {
		this.strivacityAuthService.logout().subscribe();
	}
}
```

### Native mode

In `native` mode the `<sty-login-renderer>` component renders the authentication UI inline using your custom widget components. You can define custom Angular components for each input type; see [Example widgets](https://github.com/Strivacity/sdk-js/tree/main/apps/angular/src/app/components/widgets).

The example widgets use SCSS for styling and Luxon for date handling:

```bash
npm install sass luxon
npm install --save-dev @types/luxon
```

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

#### Login page example

The login page extracts `session_id` and optionally `language` from the URL on load, cleans up the URL, and passes them to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new one. When a `language` parameter is present it overrides `uiLocales` to display the authentication UI in the specified language.

```html
<!-- login.component.html -->
<sty-login-renderer
	[widgets]="widgets"
	[sessionId]="sessionId"
	(login)="onLogin()"
	(fallback)="onFallback($event)"
	(error)="onError($event)"
	(globalMessage)="onGlobalMessage($event)"
	(blockReady)="onBlockReady($event)"
/>
```

```ts
// login.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StyLoginRenderer, FallbackError, type LoginFlowState } from '@strivacity/sdk-angular';
import { widgets } from './components/widgets';

@Component({
	standalone: true,
	selector: 'app-login',
	templateUrl: './login.component.html',
	imports: [StyLoginRenderer],
})
export class LoginComponent implements OnInit {
	widgets = widgets;
	sessionId: string | null = null;

	constructor(private router: Router) {}

	ngOnInit(): void {
		if (window.location.search !== '') {
			const url = new URL(window.location.href);
			this.sessionId = url.searchParams.get('session_id');
			url.search = '';
			history.replaceState({}, '', url.toString());
		}
	}

	onLogin(): void {
		this.router.navigateByUrl('/profile');
	}

	onFallback(error: FallbackError): void {
		if (error.url) {
			window.location.href = error.url.toString();
		} else {
			alert(error);
		}
	}

	onError(error: string): void {
		alert(error);
	}

	onGlobalMessage(message: string): void {
		alert(message);
	}

	onBlockReady({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }): void {
		console.log('previousState', previousState);
		console.log('state', state);
	}
}
```

#### Callback page example

When a `session_id` is present in the URL the native flow is resumed by forwarding it to the login page. Otherwise the standard `handleCallback()` path is used:

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
		const url = new URL(location.href);
		const sessionId = url.searchParams.get('session_id');

		if (sessionId) {
			this.router.navigate(['/login'], { queryParams: { session_id: sessionId } });
		} else {
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
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
```

#### Entry page example

The entry page processes flows started by an external process (e.g. password reset) by calling `entry()` to extract the necessary parameters to resume the flow and forwarding them to the callback page:

```ts
// entry.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	standalone: true,
	selector: 'app-entry',
	template: '<section><h1>Loading...</h1></section>',
})
export class EntryComponent implements OnInit, OnDestroy {
	readonly subscription = new Subscription();

	constructor(
		private router: Router,
		private strivacityAuthService: StrivacityAuthService,
	) {}

	async ngOnInit(): Promise<void> {
		try {
			const data = await firstValueFrom(this.strivacityAuthService.entry());

			if (data && Object.keys(data).length > 0) {
				await this.router.navigate(['/callback'], { queryParams: data });
			} else {
				await this.router.navigateByUrl('/');
			}
		} catch (error) {
			console.error('Entry failed:', error);
			await this.router.navigateByUrl('/');
		}
	}

	ngOnDestroy(): void {
		this.subscription.unsubscribe();
	}
}
```

#### Profile page example

Same as the profile page example in redirect/popup mode.

#### Logout page example

Same as the logout page example in redirect/popup mode.

### Embedded mode

In `embedded` mode the `<sty-login>` web component (loaded via `bundle.js` from the cluster) handles rendering. Import the bundle in your `main.ts` to register the Strivacity web components, and add `CUSTOM_ELEMENTS_SCHEMA` to your module or component:

```ts
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

void import(`${environment.issuer}/assets/components/bundle.js`);

bootstrapApplication(AppComponent, appConfig);
```

```ts
// login.component.ts (embedded mode)
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
	standalone: true,
	selector: 'app-login',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<sty-notifications></sty-notifications>
		<sty-login [shortAppId]="shortAppId" [sessionId]="sessionId" (close)="onClose()" (login)="onLogin()" (error)="onError($event.detail)"></sty-login>
		<sty-language-selector></sty-language-selector>
	`,
})
export class LoginComponent {
	shortAppId: string | null = null;
	sessionId: string | null = null;

	constructor(private router: Router) {
		if (location.search !== '') {
			const url = new URL(window.location.href);
			this.shortAppId = url.searchParams.get('short_app_id');
			this.sessionId = url.searchParams.get('session_id');
			url.search = '';
			history.replaceState({}, '', url.toString());
		}
	}

	onLogin(): void {
		this.router.navigateByUrl('/profile');
	}

	onClose(): void {
		location.reload();
	}

	onError(detail: string): void {
		alert(detail);
	}
}
```

## Logging

The SDK supports optional logging to help you debug authentication flows and monitor SDK behavior. You can enable the built-in console logger or provide your own custom logger implementation.

### Using the Default Logger

Enable the default console logger by adding the `logging` option when configuring the SDK:

```ts
import { provideStrivacity, DefaultLogging } from '@strivacity/sdk-angular';

export const appConfig: ApplicationConfig = {
	providers: [
		...provideStrivacity({
			mode: 'redirect',
			issuer: 'https://<YOUR_DOMAIN>',
			scopes: ['openid', 'profile'],
			clientId: '<YOUR_CLIENT_ID>',
			redirectUri: '<YOUR_REDIRECT_URI>',
			logging: DefaultLogging,
		}),
	],
};
```

The default logger writes to the browser console and automatically prefixes messages with a correlation ID when available (via the `xEventId` property).

### Creating a Custom Logger

Implement the `SDKLogging` interface and pass your class to the `logging` option:

```typescript
import type { SDKLogging } from '@strivacity/sdk-angular';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
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

The `SDKLogging` interface requires `debug`, `info`, `warn`, and `error` methods. The optional `xEventId` property, when set by the SDK, provides a correlation ID to trace related log messages across the authentication flow.

## HTTP Client

The SDK uses a built-in `fetch`-based HTTP client for all requests. You can replace it with your own implementation by extending `SDKHttpClient` and passing your class via the `httpClient` option. This is useful when you need to attach custom headers (e.g. `x-sty-app-id`) to every outgoing request or use a platform-specific transport such as Capacitor's `CapacitorHttp`.

### Adding custom headers to every request

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideStrivacity, SDKHttpClient, type HttpClientResponse } from '@strivacity/sdk-angular';

class CustomHttpClient extends SDKHttpClient {
	async request<T>(url: string, options?: RequestInit): Promise<HttpClientResponse<T>> {
		const mergedOptions: RequestInit = {
			...options,
			headers: {
				'x-sty-app-id': 'my-app',
				...(options?.headers as Record<string, string>),
			},
		};

		const response = await fetch(url, mergedOptions);

		return {
			headers: response.headers,
			ok: response.ok,
			status: response.status,
			statusText: response.statusText,
			url: response.url,
			json: async () => (await response.json()) as T,
			text: async () => await response.text(),
		};
	}
}

export const appConfig: ApplicationConfig = {
	providers: [
		provideStrivacity({
			// ...other options
			httpClient: CustomHttpClient,
		}),
	],
};
```

Any header you add inside `request()` is automatically included in every SDK request

### CORS configuration

For custom request headers to reach the Strivacity cluster, the cluster must be configured to explicitly allow them. Add the header name(s) to the **Access-Control-Allow-Headers** list in the cluster settings. Without this, browsers will block the preflight `OPTIONS` request and the SDK call will fail with a CORS error.

```
Access-Control-Allow-Headers: x-sty-app-id, <any other custom headers>
```

## API Documentation

### `StrivacityAuthService`

An injectable Angular service providing reactive authentication state and methods.

**Properties**

- **`sdk: RedirectFlow | PopupFlow | NativeFlow`**: The underlying SDK flow instance.
- **`session$: Observable<Session>`**: Observable stream of the current session state.

**Session type**

- **`loading: boolean`**: `true` while the session is being initialized.
- **`isAuthenticated: boolean`**: `true` when the user has a valid session.
- **`idTokenClaims: IdTokenClaims | null`**: Claims from the ID token, or `null` if not authenticated.
- **`accessToken: string | null`**: The current access token.
- **`refreshToken: string | null`**: The current refresh token.
- **`accessTokenExpired: boolean`**: `true` when the access token has expired.
- **`accessTokenExpirationDate: number | null`**: Expiration timestamp (Unix seconds) of the access token.

**Methods**

- **`isAuthenticated(): boolean`**: Returns whether the user is currently authenticated.
- **`login(options?: LoginOptions): Observable<void>`**: Initiates login.
- **`register(options?: RegisterOptions): Observable<void>`**: Initiates registration.
- **`refresh(): Observable<void>`**: Refreshes the user's session.
- **`revoke(): Observable<void>`**: Revokes the current session tokens.
- **`logout(options?: LogoutOptions): Observable<void>`**: Logs the user out.
- **`handleCallback(url?: string): Observable<void>`**: Processes the authorization callback.
- **`entry(): Observable<Record<string, string>>`**: Processes an externally-initiated flow URL and returns the parameters needed to resume the flow.

---

### `StyLoginRenderer` component

Used in `native` mode to render the authentication UI with your own widget components.

**Selector:** `sty-login-renderer`

**Inputs**

- **`params?: NativeParams`**: Additional parameters for the native login flow.
- **`widgets?: PartialRecord<WidgetType, Type<any>>`**: Custom Angular components for each widget type used in the flow.
- **`sessionId?: string | null`**: Session ID for resuming an existing authentication session.

**Outputs**

- **`(login)`**: Emitted on successful authentication. Receives `IdTokenClaims | null`.
- **`(fallback)`**: Emitted when the native flow needs to fall back to redirect. Receives `FallbackError` with a fallback URL.
- **`(error)`**: Emitted when an error occurs during authentication.
- **`(globalMessage)`**: Emitted when the flow wants to display a global message (e.g. account lockout warning).
- **`(blockReady)`**: Emitted on flow state transitions. Receives `{ previousState: LoginFlowState; state: LoginFlowState }`. Useful for analytics and custom logging.

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

@strivacity/sdk-angular is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).

## Migrating to v3.0

### Entry API Major Changes

Strivacity SDK's `entry()` API now returns a structured object instead of a plain string. Check the example above in the usage section for more details.
