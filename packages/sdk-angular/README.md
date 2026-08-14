# @strivacity/sdk-angular

Angular SDK for [Strivacity](https://www.strivacity.com) - adds PKCE-protected OIDC authentication, server-managed sessions, and self-service account management to your Angular application.

> See the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/angular) for a complete, working reference implementation covering all four login modes, or the [AnalogJS example app](https://github.com/Strivacity/sdk-js/tree/main/apps/analogjs) for the same demo built on AnalogJS's file-based router and Nitro server.

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choosing a mode](#choosing-a-mode)
- [Client-side vs server-managed sessions](#client-side-vs-server-managed-sessions)
- [Quick start - CSR](#quick-start--csr)
- [Quick start - hybrid rendering (SSR)](#quick-start--hybrid-rendering-ssr)
- [Login flows](#login-flows)
  - [redirect](#redirect-mode)
  - [popup](#popup-mode)
  - [embedded](#embedded-mode)
  - [native](#native-mode)
  - [Custom login session URI](#custom-login-session-uri)
- [Client API](#client-api)
- [Server API](#server-api)
- [Protecting pages](#protecting-pages)
- [Session storages](#session-storages)
- [SDK events](#sdk-events)
- [Back-channel logout](#back-channel-logout)
- [Configuration reference](#configuration-reference)

---

## Prerequisites

- Angular 20+
- A Strivacity tenant with an application configured (issuer URL, client ID, redirect URI)

---

## Installation

```bash
npm install @strivacity/sdk-angular
```

---

## Choosing a mode

The SDK supports four login flow modes. Choose based on your UX and deployment requirements.

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where and how the login UI is rendered.

| Mode       | Login UI                                 | Best for                                     |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `redirect` | Strivacity hosted page                   | Standard web apps                            |
| `popup`    | Strivacity hosted page in a popup        | SPAs that must stay on the current page      |
| `embedded` | Strivacity web components in your page   | Branded login inside your own layout         |
| `native`   | Your own components driven by flow state | Full UI control, step-by-step form rendering |

> All modes use the same PKCE-protected OIDC flow under the hood. The `mode` option only controls where the login UI lives and how the flow state is consumed.

---

## Client-side vs server-managed sessions

### CSR (Client-Side Rendering)

The SDK is initialized entirely in the browser through `provideStrivacity()`. No server-side route is required. Multiple client-side session storages are available out of the box - see [Session storages](#session-storages) for the full list. The default is `localStorage`.

**When to use:** Purely client-rendered apps, or situations where you don't want to manage sessions on the server.

### Hybrid rendering (SSR)

When the app is built with `@angular/ssr` and `serverSideSession: true` is set, tokens never reach the browser. They're stored server-side in a **stateless, encrypted, HTTP-only cookie** managed by the Express router returned by `createServerSDK()` (from `@strivacity/sdk-angular/server`). `provideStrivacityServerSession()` reads the current session on every SSR request and hands it to the client through Angular's `TransferState`, so `StrivacityAuthService` hydrates synchronously - no extra round-trip or loading flash, and pages can render as authenticated on the server before any client-side JavaScript runs.

There is no automatic route registration - you mount the SDK's Express router yourself in `server.ts`, at whichever prefix you configure via `authUrlPrefix`.

**When to use:** Apps built with `@angular/ssr` where the login UI is hosted by Strivacity (`redirect`/`popup`) or driven by your own layout (`embedded`/`native`) but the session itself should never touch browser storage.

---

## Quick start - CSR

### 1. Configure the SDK options

Define the core OIDC parameters your app will use. These values come from your Strivacity application configuration. The `mode` field controls which login flow the SDK uses.

```ts
// app.config.ts
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStrivacity, createDefaultLogging } from '@strivacity/sdk-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes),
		provideStrivacity({
			mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native'
			issuer: 'https://YOUR_TENANT.strivacity.com', // OIDC issuer URL of your Strivacity tenant
			clientId: 'YOUR_CLIENT_ID', // OAuth2 public client ID
			redirectUri: 'https://YOUR_APP/callback', // OAuth2 redirect URI registered in your app config
			scopes: ['openid', 'profile', 'email'], // requested OIDC scopes
			logging: createDefaultLogging(),
			// storageTokenName: 'sty.session', // custom storage key for the session
		}),
	],
};
```

### 2. Bootstrap the app

```ts
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { App } from './app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

> For an `NgModule`-based bootstrap instead, replace `provideStrivacity()` with `StrivacityAuthModule.forRoot()` in your root module's `imports`, and bootstrap with `platformBrowser().bootstrapModule()` instead of `bootstrapApplication()`:
>
> ```ts
> // app.module.ts
> import { NgModule } from '@angular/core';
> import { BrowserModule } from '@angular/platform-browser';
> import { RouterModule } from '@angular/router';
> import { StrivacityAuthModule, createDefaultLogging } from '@strivacity/sdk-angular';
> import { routes } from './app.routes';
> import { App } from './app';
>
> @NgModule({
> 	declarations: [App],
> 	imports: [
> 		BrowserModule,
> 		RouterModule.forRoot(routes),
> 		StrivacityAuthModule.forRoot({
> 			mode: 'redirect',
> 			issuer: 'https://YOUR_TENANT.strivacity.com',
> 			clientId: 'YOUR_CLIENT_ID',
> 			redirectUri: 'https://YOUR_APP/callback',
> 			scopes: ['openid', 'profile', 'email'],
> 			logging: createDefaultLogging(),
> 		}),
> 	],
> 	bootstrap: [App],
> })
> export class AppModule {}
> ```
>
> ```ts
> // main.ts
> import { platformBrowser } from '@angular/platform-browser';
> import { AppModule } from './app.module';
>
> platformBrowser()
> 	.bootstrapModule(AppModule)
> 	.catch((err) => console.error(err));
> ```

### 3. Use the auth state

Inject `StrivacityAuthService` in any standalone component to read the current authentication state (exposed as signals) and trigger login or logout. `loading()` is `true` during the initial SDK setup - guard against rendering until it resolves.

```ts
// nav.ts
import { Component, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-nav',
	templateUrl: './nav.html',
})
export class Nav {
	protected readonly authService = inject(StrivacityAuthService);
}
```

```html
<!-- nav.html -->
@if (!authService.loading()) { @if (authService.isAuthenticated()) {
<span>Hello, {{ authService.idTokenClaims()?.given_name }}</span>
<button (click)="authService.logout()">Log out</button>
} @else {
<button (click)="authService.login()">Log in</button>
} }
```

---

## Quick start - hybrid rendering (SSR)

### 1. Configure the SDK options

Same as in the CSR setup, with `serverSideSession: true` added to tell the SDK to store tokens on the server instead of in the browser. This config is shared between the client and server bootstraps.

```ts
// app.config.ts
import type { SDKOptions } from '@strivacity/sdk-angular';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideStrivacity, createDefaultLogging } from '@strivacity/sdk-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes),
		provideClientHydration(withEventReplay()),
		provideStrivacity({
			mode: 'redirect' as SDKOptions['mode'],
			issuer: 'https://YOUR_TENANT.strivacity.com',
			clientId: 'YOUR_CLIENT_ID',
			redirectUri: 'https://YOUR_APP/callback',
			scopes: ['openid', 'profile', 'email'],
			serverSideSession: true, // store the session on the server (required for SSR)
			logging: createDefaultLogging(),
		}),
	],
};
```

### 2. Create the server SDK instance

Instantiates the server-side SDK. The `secret` is used to encrypt the session cookie, so raw tokens never leave the server. Guard against the fact that Angular's build also imports this module to statically extract the server route config, with no real request or env vars available.

```ts
// server/strivacity.ts
import type { AngularServerSDK, AngularServerSDKInitConfig } from '@strivacity/sdk-angular/server';
import { createServerSDK } from '@strivacity/sdk-angular/server';

export const sdkOptions: AngularServerSDKInitConfig = {
	mode: 'redirect',
	issuer: process.env['ISSUER'],
	clientId: process.env['CLIENT_ID'],
	redirectUri: process.env['REDIRECT_URI'],
	scopes: ['openid', 'profile', 'email'],
	secret: process.env['SECRET'], // used to encrypt the session cookie
	authUrlPrefix: '/auth', // URL prefix under which the SDK's router is mounted
};

export let serverSdk: AngularServerSDK | undefined;

if (sdkOptions.mode && sdkOptions.issuer && sdkOptions.clientId && sdkOptions.redirectUri) {
	serverSdk = createServerSDK(sdkOptions);
}
```

### 3. Mount the Express router

A single router handles all auth traffic: login initiation, the OAuth2 callback (code exchange), logout, silent refresh, revoke, entry, and back-channel logout - no custom logic needed.

```ts
// server/server.ts
import { AngularNodeAppEngine, createNodeRequestHandler, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { sdkOptions, serverSdk } from './strivacity';

const app = express();
const angularApp = new AngularNodeAppEngine();

if (serverSdk) {
	app.use(sdkOptions.authUrlPrefix!, serverSdk.router);
}

app.use((req, res, next) => {
	angularApp
		.handle(req)
		.then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
		.catch(next);
});

export const reqHandler = createNodeRequestHandler(app);
```

### 4. Hydrate the session on the server

`provideStrivacityServerSession()` reads the session before the app renders and hands it to the client via `TransferState`, so `StrivacityAuthService` hydrates without a loading flash.

```ts
// server/app.config.ts
import { type ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { provideStrivacityServerSession } from '@strivacity/sdk-angular/server';
import { appConfig } from '../app/app.config';
import { serverRoutes } from './app.routes';
import { serverSdk } from './strivacity';

const serverConfig: ApplicationConfig = {
	providers: [provideServerRendering(withRoutes(serverRoutes)), provideStrivacityServerSession(serverSdk)],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

### 5. Protect pages

Guard routes with a `CanActivateFn` - see [Protecting pages](#protecting-pages) for the full pattern, including real HTTP redirects during SSR.

```ts
// app.routes.ts
import type { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { ProfilePage } from './pages/profile';

export const routes: Routes = [{ path: 'profile', component: ProfilePage, canActivate: [authGuard] }];
```

---

## Login flows

### redirect mode

The user is redirected to the Strivacity-hosted login page and then back to your app after authentication.

```ts
protected readonly authService = inject(StrivacityAuthService);

ngOnInit(): void {
	void this.authService.login({
		// Optional parameters
		loginHint: 'user@example.com', // pre-fill the identifier field
		acrValues: ['urn:strivacity:loa:2'], // request MFA step-up
		audiences: ['https://api.example.com'], // extra access token audiences
	});
}
```

#### Handle the callback

Your callback route's component calls `authService.handleCallback()`, which exchanges the authorization code for tokens and stores the session:

```ts
// pages/callback/callback.ts
async ngOnInit(): Promise<void> {
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
```

### popup mode

The Strivacity login page opens in a separate window. After the user authenticates, the popup closes and the parent page receives the session automatically - no callback page needed.

Configuration is the same as `redirect` - just set `mode: 'popup'`. `login()` opens the popup automatically; pass `popupWindowTarget`/`popupWindowFeatures` to control its size and position.

### embedded mode

The login UI renders inside your own page using Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`) - `sty-notifications` shows toast-style system notifications and `sty-language-selector` lets the user switch the login flow's language. Load the components bundle with `injectScript`, then mount the elements. The SDK doesn't ship an Angular wrapper for these, so add `CUSTOM_ELEMENTS_SCHEMA` to your component and bind properties/events directly:

```ts
// pages/login/login.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, type OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { injectScript, StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-login-page',
	templateUrl: './login.html',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage implements OnInit {
	private readonly authService = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	protected readonly issuer = this.authService.sdk.options.issuer;

	ngOnInit(): void {
		injectScript('sty-components', `${this.issuer}/assets/components/bundle.js`);
	}

	protected onLogin(): void {
		void this.router.navigateByUrl('/profile');
	}

	protected onClose(): void {
		globalThis.location.reload();
	}

	protected onError(event: Event): void {
		alert((event as CustomEvent<string>).detail);
	}
}
```

```html
<!-- pages/login/login.html -->
<section>
	<sty-notifications></sty-notifications>
	<sty-login [params]="{}" (login)="onLogin()" (close)="onClose()" (error)="onError($event)"></sty-login>
	<sty-language-selector></sty-language-selector>
</section>
```

#### Controlling when the flow starts

By default the login flow starts automatically as soon as `sty-login` connects to the DOM. Add the `lazy` attribute and a template reference variable to take manual control, then call `start()` when ready:

```html
<button (click)="loginEl.start({ loginHint: 'user@example.com' })">Continue to login</button> <sty-login #loginEl lazy [params]="{}"></sty-login>
```

#### Externally-initiated flows (entry)

For flows started externally (e.g. a password reset email link), point the link at your server's `/auth/entry` route - it resolves the challenge against the IDP and redirects to your login page with `session_id`, `short_app_id`, and `language` as query parameters. Read them from `ActivatedRoute` and pass them to the `sty-login` element via `[sessionId]`/`[shortAppId]`/`[lang]` bindings.

### native mode

You build the entire login UI with your own Angular components using `StrivacityNativeLoginService`. Provide it at the component level (it's `@Injectable()` without `providedIn: 'root'`, so a fresh instance is created per login page), then call `start()` once from `ngOnInit`. It exposes `loading`, `forms` (current field values), `messages` (validation/info messages), and `state` (the current `LoginFlowState` - `screen`, `forms` widget definitions, `layout`, `finalizeUrl`, ...) as signals, plus `submitForm()`, `setFormValue()`, `setMessage()`, `triggerFallback()`, `triggerClose()`.

> The SDK does **not** ship ready-made widget components or a renderer for native mode - it only provides the state machine. Build your own widget components (or copy the ones from the [example app](https://github.com/Strivacity/sdk-js/tree/main/apps/angular/src/app/components/login)) that read/write state via the injected `StrivacityNativeLoginService`, and a renderer that walks `state().layout.items` (each item is either `{ type: 'widget', formId, widgetId }`, resolved by looking it up in `state().forms`, or a nested `{ type: 'vertical' | 'horizontal', items: [...] }` group) to decide what to render and in what order.

```ts
// pages/login/login.ts
import { Component, type OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';
import { NativeLoginRendererComponent } from '../../components/login';

@Component({
	selector: 'app-login-page',
	templateUrl: './login.html',
	imports: [NativeLoginRendererComponent],
	providers: [StrivacityNativeLoginService],
})
export class LoginPage implements OnInit {
	protected readonly nativeLoginService = inject(StrivacityNativeLoginService);
	private readonly router = inject(Router);

	ngOnInit(): void {
		void this.nativeLoginService.start({
			params: {
				// Optional parameters
				loginHint: 'user@example.com',
				acrValues: ['urn:strivacity:loa:2'],
				audiences: ['https://api.example.com'],
				loginSessionUri: '/auth/login/session',
			},
			onLogin: async () => {
				await this.router.navigateByUrl('/profile');
			},
			onClose: () => {
				globalThis.location.reload();
			},
			// called when the native flow cannot continue (e.g. unsupported step) - fall back to the hosted login page
			onFallback: (error) => {
				globalThis.location.href = error.url.toString();
			},
			onError: async (error) => {
				await this.router.navigate(['/error'], { queryParams: { message: error.message } });
			},
		});
	}
}
```

```html
<!-- pages/login/login.html -->
@if (nativeLoginService.loading() || !nativeLoginService.state().screen) {
<p>Loading...</p>
} @else {
<app-native-login-renderer />
}
```

#### Externally-initiated flows (entry)

Same as for embedded mode: point your Strivacity tenant's email link destination at your server's `/auth/entry` route, then pass the resolved `session_id`/`short_app_id`/`language` query parameters via `params` to `start()`.

---

### Custom login session URI

All four modes accept an optional `loginSessionUri` parameter to start the flow through your own server-side endpoint (e.g. a BFF) instead of the SDK's default IDP endpoint - useful when the request must be built/signed server-side. Sensitive OAuth2 parameters (`client_id`, `redirect_uri`, `scope`, PKCE, ...) are never sent to `loginSessionUri` - your endpoint is responsible for adding those itself; only the non-sensitive extras (`prompt`, `display`, `acrValues`, `loginHint`, `uiLocales`, `audiences`) are appended as query params.

Pass it to `login()`/`register()` (`redirect`/`popup`) or as part of `params` to `StrivacityNativeLoginService.start()` (`native`). For server-managed sessions, the built-in `/auth/login/session` route (mounted under `authUrlPrefix`, see [Server API](#server-api)) already acts as a ready-made `loginSessionUri` target:

```ts
// redirect / popup
await authService.login({ loginSessionUri: '/auth/login/session' });

// native
nativeLoginService.start({ params: { loginSessionUri: '/auth/login/session' } });
```

`embedded` mode supports the same parameter directly on the `sty-login` element - pass it via the `[params]` binding instead of letting it build the default IDP request:

```html
<sty-login [params]="{ loginSessionUri: '/auth/login/session' }"></sty-login>
```

---

## Client API

All client exports come from `@strivacity/sdk-angular`.

### `provideStrivacity(config)`

Registers the SDK configuration and `StrivacityAuthService` as providers. Add it to your `ApplicationConfig` (or a route/component injector for scoped configuration).

```ts
providers: [provideStrivacity(sdkOptions)];
```

Returns `Provider[]` - `[{ provide: STRIVACITY_SDK, useValue: config }, StrivacityAuthService]`.

### `StrivacityAuthModule.forRoot(config)`

`NgModule`-based equivalent of `provideStrivacity()`, for applications that still bootstrap via `NgModule`. Import once at the root module.

```ts
@NgModule({
	imports: [StrivacityAuthModule.forRoot(sdkOptions)],
})
export class AppModule {}
```

### `StrivacityAuthService`

Signal-based service exposing the SDK state and actions. Inject it wherever you need auth state or actions.

| Member                        | Type                                    | Description                                                                  |
| ----------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| `sdk`                         | `SDKInstance` (readonly)                | The underlying SDK flow instance (advanced use - e.g. `sdk.options`)         |
| `loading()`                   | `Signal<boolean>`                       | `true` until the SDK finished initializing                                   |
| `language()`                  | `Signal<string>`                        | Current UI language                                                          |
| `isAuthenticated()`           | `Signal<boolean>`                       | `true` if an access token exists and hasn't expired                          |
| `idTokenClaims()`             | `Signal<IdTokenClaims \| null>`         | Decoded claims from the ID token                                             |
| `accessToken()`               | `Signal<string \| null>`                | Current access token                                                         |
| `refreshToken()`              | `Signal<string \| null>`                | Current refresh token                                                        |
| `accessTokenExpired()`        | `Signal<boolean>`                       | `true` if the access token has passed its expiration time                    |
| `accessTokenExpirationDate()` | `Signal<number \| null>`                | Unix timestamp (seconds) when the access token expires                       |
| `init()`                      | `() => Promise<void>`                   | Initializes the SDK (usually not needed - happens automatically)             |
| `login(params?)`              | `() => Promise<void>`                   | Starts the login flow (mode-dependent)                                       |
| `register(params?)`           | `() => Promise<void>`                   | Starts the registration flow (shorthand for `login` with `prompt: 'create'`) |
| `logout(params?)`             | `() => Promise<void>`                   | Logs the user out                                                            |
| `refresh()`                   | `() => Promise<void>`                   | Refreshes the access token using the stored refresh token                    |
| `revoke()`                    | `() => Promise<void>`                   | Revokes the current tokens                                                   |
| `entry(url?)`                 | `() => Promise<Record<string, string>>` | Resolves an externally-initiated flow challenge                              |
| `handleCallback(url?)`        | `() => Promise<void>`                   | Processes the OAuth2 callback (extracts code, exchanges for tokens)          |
| `checkAuthentication(opts?)`  | `() => Promise<boolean>`                | Checks whether the user is authenticated (may auto-refresh)                  |
| `getAccessToken(opts?)`       | `() => Promise<string \| null>`         | Gets the current access token (may auto-refresh if expired)                  |
| `tokenExchange(params?)`      | `() => Promise<void>`                   | Exchanges an authorization code for tokens directly                          |
| `subscribeToEvent(name, cb)`  | `() => { dispose(): void }`             | Subscribes to a single [SDK event](#sdk-events)                              |
| `subscribeToAllEvents(cb)`    | `() => { dispose(): void }`             | Subscribes to all SDK events                                                 |

### `StrivacityNativeLoginService`

Drives a [native mode](#native-mode) login flow. Provide it at the component level (not `providedIn: 'root'`) so each login page gets its own instance.

| Member                                  | Type                                                       | Description                                                                       |
| --------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `loading()`                             | `Signal<boolean>`                                          | `true` while a screen is being fetched                                            |
| `forms()`                               | `Signal<Record<string, Record<string, unknown>>>`          | Current form values, keyed by `formId → widgetId`                                 |
| `messages()`                            | `Signal<Record<string, Record<string, LoginFlowMessage>>>` | Validation/info messages, keyed by `formId → widgetId`                            |
| `state()`                               | `Signal<Partial<LoginFlowState>>`                          | Current flow state (`screen`, `forms`, `layout`, `finalizeUrl`, `hostedUrl`, ...) |
| `start(options?)`                       | `(options?: NativeLoginOptions) => Promise<void>`          | Starts the flow; call once from `ngOnInit`                                        |
| `submitForm(formId, customBody?)`       | `() => Promise<void>`                                      | Submits a form's current values (or a custom body) to advance the flow            |
| `setFormValue(formId, widgetId, value)` | `() => void`                                               | Updates a single field's value in `forms()`                                       |
| `setMessage(formId, widgetId, value)`   | `() => void`                                               | Sets a validation/info message in `messages()`                                    |
| `triggerFallback(message?)`             | `() => void`                                               | Falls back to the hosted login page (`onFallback` callback)                       |
| `triggerClose()`                        | `() => void`                                               | Invokes the `onClose` callback                                                    |

---

## Server API

All server exports come from `@strivacity/sdk-angular/server` and require Node.js + Express (declared as an optional peer dependency).

### `createServerSDK(config)`

Creates the server-side SDK: an Express router exposing the auth endpoints, plus session helpers you can reuse elsewhere on the server.

```ts
import { createServerSDK } from '@strivacity/sdk-angular/server';

export const serverSdk = createServerSDK({
	mode: 'redirect',
	issuer: 'https://YOUR_TENANT.strivacity.com',
	clientId: 'YOUR_CLIENT_ID',
	redirectUri: 'https://YOUR_APP/callback',
	scopes: ['openid', 'profile', 'email'],
	secret: 'YOUR_SECRET',
});
```

Returns an `AngularServerSDK`:

| Member                                      | Signature                                                            | Description                                                           |
| ------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `router`                                    | `express.Router`                                                     | Mount this at `authUrlPrefix` (see routes table below)                |
| `httpClient`                                | `SDKHttpClient` (read-only)                                          | The HTTP client used for requests to the Strivacity API               |
| `getSession(req?)`                          | `(req?: AngularServerRequest) => Promise<SessionData \| null>`       | Reads the current session from the configured storage                 |
| `updateSession(session, req?, res?)`        | `(session: SessionData, req?, res?) => Promise<void>`                | Persists a session (e.g. after a custom token exchange)               |
| `refreshSession(req?, res?)`                | `(req?, res?) => Promise<SessionData>`                               | Refreshes the access token using the stored refresh token             |
| `revokeSession(req?, res?)`                 | `(req?, res?) => Promise<void>`                                      | Revokes the current session's tokens and clears storage               |
| `logout(postLogoutRedirectUri, req?, res?)` | `(postLogoutRedirectUri: string \| URL, req?, res?) => Promise<URL>` | Clears the session and returns the IDP end-session URL to redirect to |

`req`/`res` accept either Express's `Request`/`Response` or a raw `Request` from Angular's `REQUEST` token, so these helpers can be called both from Express middleware and from app initializers running inside Angular's SSR pipeline.

The router exposes the following endpoints, relative to wherever you mount it (`authUrlPrefix`, default `/auth`):

| Route                      | Purpose                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /login`               | Starts a login session and redirects to the IDP (or your `loginSessionUri`, if the login was initiated with one) |
| `GET /login/session`       | Starts an **embedded**/**native**-mode login session server-side; the default `loginSessionUri` target           |
| `GET /register`            | Same as `/login` with `prompt=create`                                                                            |
| `GET /callback`            | Exchanges the authorization code for tokens, stores the session, and redirects to `postLoginRedirectUri`         |
| `GET /refresh`             | Refreshes the access token using the stored refresh token                                                        |
| `GET /revoke`              | Revokes the current session's tokens and clears the session cookie                                               |
| `GET /entry`               | Resolves an externally-initiated flow challenge and redirects to the login page with its parameters              |
| `GET /logout`              | Deletes the local session and redirects to the IDP end-session endpoint                                          |
| `POST /backchannel-logout` | Receives IDP back-channel logout notifications - see [Back-channel logout](#back-channel-logout)                 |

```ts
// server/server.ts
import express from 'express';
import { sdkOptions, serverSdk } from './strivacity';

const app = express();

if (serverSdk) {
	app.use(sdkOptions.authUrlPrefix!, serverSdk.router);
}
```

### `provideStrivacityServerSession(serverSdk)`

Registers an app initializer that reads the current session (via `serverSdk.getSession(request)`, using Angular's `REQUEST` token) before the app renders, and hands it to the client through `TransferState` so `StrivacityAuthService` can hydrate without a loading flash. A no-op if `serverSdk` is `undefined` (e.g. because required env vars aren't configured yet).

```ts
// server/app.config.ts
import { provideStrivacityServerSession } from '@strivacity/sdk-angular/server';
import { serverSdk } from './strivacity';

providers: [provideStrivacityServerSession(serverSdk)];
```

### My Account API (server)

There is no dedicated server-side My Account wrapper - call the `@strivacity/sdk-core/utils/myaccount` functions directly from a server route, using the session's access token and the SDK options:

```ts
// server/api/account.ts
import * as myAccount from '@strivacity/sdk-core/utils/myaccount';
import { serverSdk } from './strivacity';

app.get('/api/account', async (req, res) => {
	const session = await serverSdk!.getSession(req);

	if (!session?.access_token) {
		return res.status(401).end();
	}

	const response = await myAccount.fetchAccountData({ token: session.access_token, options: serverSdk!.options });
	res.json(await response.json());
});
```

For the full method list see [`@strivacity/sdk-core` — My Account API](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core#my-account-api).

---

## Protecting pages

Use a `CanActivateFn` route guard. Return `true` when authenticated, or a `RedirectCommand` (not a bare `UrlTree`) so a real HTTP redirect is issued during SSR instead of Angular silently swallowing the navigation:

```ts
// guards/auth.guard.ts
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
// app.routes.ts
export const routes: Routes = [{ path: 'profile', component: ProfilePage, canActivate: [authGuard] }];
```

---

## Session storages

### Client-side

Tokens and session data are stored entirely on the client side. The default storage is `localStorage`, but you can swap it out by passing any of the built-in factory functions - or any object implementing `SDKStorage` (`get`, `set`, `delete`) - as the `storage` option to `provideStrivacity()`.

| Storage          | Export                        | Persists across                                  |
| ---------------- | ----------------------------- | ------------------------------------------------ |
| `localStorage`   | `createLocalStorage()`        | browser restarts                                 |
| `sessionStorage` | `createSessionStorage()`      | tab lifetime                                     |
| `IndexedDB`      | `createIndexedDBStorage()`    | browser restarts, larger quota                   |
| `Cookie`         | `createCookieStorage(opts?)`  | configurable expiry                              |
| `Cache API`      | `createCacheAPIStorage()`     | browser restarts; works in Service Workers too   |
| `Memory`         | `createMemoryStorage()`       | page lifetime only                               |
| `Worker`         | `createWorkerStorage(worker)` | depends on the backing storage inside the Worker |

```ts
// app.config.ts
import { provideStrivacity, createCookieStorage } from '@strivacity/sdk-angular';

provideStrivacity({
	// ...
	storage: createCookieStorage({ maxAge: 2592000, sameSite: 'Lax' }),
});
```

### Server-side

By default the server SDK stores sessions in a **stateless, encrypted, HTTP-only cookie** (`getEncryptedCookieStorage`, from `@strivacity/sdk-angular/server`). The cookie is AES-encrypted using the `secret` you provide and automatically chunked when the payload is too large for a single cookie.

| Storage          | Export                                     | Notes                                      |
| ---------------- | ------------------------------------------ | ------------------------------------------ |
| Encrypted cookie | `getEncryptedCookieStorage(secret, opts?)` | Default; AES-encrypted, HTTP-only, chunked |

Any custom backend can be passed via the `storage` option in `createServerSDK`. It must implement the `AngularServerStorage` interface (`get`, `set`, `delete`, and an optional `deleteByLogoutToken` for [back-channel logout](#back-channel-logout)).

```ts
// server/strivacity.ts
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { sessionStorage } from './storage'; // your own AngularServerStorage implementation

export const serverSdk = createServerSDK({
	// ...
	storage: sessionStorage,
});
```

---

## SDK events

Subscribe to authentication lifecycle events via `subscribeToEvent` (one specific event) or `subscribeToAllEvents` (all events) on `StrivacityAuthService`. Both return a `{ dispose() }` handle - call it in `ngOnDestroy`/`DestroyRef.onDestroy()`.

| Event                | Payload                                 | When it fires                                                             |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `init`               | -                                       | SDK has finished initializing                                             |
| `sessionLoaded`      | `{ accessToken, refreshToken, claims }` | An existing session was read from storage on startup                      |
| `loginInitiated`     | -                                       | A login or registration redirect / popup has started                      |
| `loggedIn`           | `{ accessToken, refreshToken, claims }` | Tokens were received and stored after a successful login                  |
| `logoutInitiated`    | `{ idToken, claims }`                   | Logout was initiated, before the redirect to the IDP end-session endpoint |
| `tokenRefreshed`     | `{ accessToken, refreshToken, claims }` | Access token was silently refreshed                                       |
| `tokenRefreshFailed` | `{ refreshToken }`                      | A token refresh attempt failed (refresh token may be expired)             |
| `accessTokenExpired` | `{ accessToken, refreshToken }`         | The stored access token has passed its expiration time                    |
| `tokenRevoked`       | `{ token, tokenTypeHint }`              | A token was successfully revoked at the authorization server              |
| `tokenRevokeFailed`  | `{ token, tokenTypeHint }`              | A token revocation attempt failed                                         |

```ts
constructor() {
	const subscription = this.authService.subscribeToEvent('tokenRefreshed', ({ accessToken }) => {
		console.log('Token refreshed:', accessToken);
	});

	inject(DestroyRef).onDestroy(() => subscription.dispose());
}
```

---

## Back-channel logout

When `serverSideSession: true`, `POST /auth/backchannel-logout` accepts [OIDC back-channel logout](https://openid.net/specs/openid-connect-backchannel-1_0.html) notifications from your Strivacity tenant (configure the destination as `https://your-app.example.com/auth/backchannel-logout`). The SDK verifies the `logout_token` JWT and, if your storage implements the optional `deleteByLogoutToken({ sid?, sub? })` method, calls it to delete the matching session(s) - the built-in encrypted cookie storage does not implement this (cookies can't be looked up by `sid`/`sub` server-initiated), so back-channel logout requires a custom, lookup-capable storage (e.g. Redis) passed via the `storage` option in `createServerSDK`.

---

## Configuration reference

| Option              | Type                                              | Required | Default                | Description                                                                                |
| ------------------- | ------------------------------------------------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `mode`              | `'redirect' \| 'popup' \| 'embedded' \| 'native'` | Yes      | -                      | Authentication flow mode                                                                   |
| `issuer`            | `string`                                          | Yes      | -                      | OIDC issuer URL of your Strivacity tenant                                                  |
| `clientId`          | `string`                                          | Yes      | -                      | OAuth2 public client ID                                                                    |
| `redirectUri`       | `string`                                          | Yes      | -                      | OAuth2 redirect URI (must match your application configuration)                            |
| `scopes`            | `string[]`                                        | No       | `['openid']`           | Requested OIDC scopes                                                                      |
| `storageTokenName`  | `string`                                          | No       | `'sty.session'`        | Key/cookie name under which the session is stored                                          |
| `serverSideSession` | `boolean`                                         | No       | `false`                | Store the session server-side (see [Architecture](#architecture-csr-and-hybrid-rendering)) |
| `loginUri`          | `string`                                          | No       | `'/login'`             | URI of the app's login page; used in `embedded`/`native` modes                             |
| `autoRefresh`       | `boolean`                                         | No       | `true`                 | Automatically refreshes the access token before it expires                                 |
| `lazyLoad`          | `boolean`                                         | No       | `false`                | When `true`, defers initialization until the first method call                             |
| `storage`           | `SDKStorage`                                      | No       | `createLocalStorage()` | Client-side session storage (see [Session storages](#session-storages))                    |
| `stateStorage`      | `SDKStorage`                                      | No       | `createLocalStorage()` | Client-side storage for the PKCE state parameter                                           |
| `logging`           | `SDKLogging`                                      | No       | -                      | Pass `createDefaultLogging()` for console logging                                          |

Angular server-only options (`AngularServerSDKOptions`, in `createServerSDK`):

| Option                  | Type     | Required                    | Default             | Description                                                                                  |
| ----------------------- | -------- | --------------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `authUrlPrefix`         | `string` | No                          | `'/auth'`           | URL prefix where you mount `createServerSDK().router`                                        |
| `postLoginRedirectUri`  | `string` | No                          | issuer origin       | Where callback redirects to after a successful login (unless a `returnTo` cookie is present) |
| `postLogoutRedirectUri` | `string` | No                          | issuer origin       | Where logout redirects to after logout                                                       |
| `secret`                | `string` | Only if no custom `storage` | -                   | Encryption secret for the built-in cookie session storage                                    |
| `cookieMaxAge`          | `number` | No                          | `2592000` (30 days) | Max age (seconds) of the session cookie when using the built-in storage                      |

For the full list of shared options see [`@strivacity/sdk-core` — Configuration reference](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core#configuration-reference).

---

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This package is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
