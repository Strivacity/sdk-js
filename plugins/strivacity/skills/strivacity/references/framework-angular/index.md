# Strivacity Angular Integration

Add Strivacity OIDC (PKCE) login to an Angular app with `@strivacity/sdk-angular` v4: standalone or `NgModule` bootstrap, signal-based services, functional route guards, and optional Angular SSR (Express) with server-managed sessions.

## Critical rules

- **Ask before creating or editing `.env` files**, and never read an existing `.env` / `.env.local` into context without explicit permission. Tell the user which variables to add instead.
- **Public PKCE client only.** No client secret anywhere. The only secret is the Server SDK `cookieSecret`. Read it from `process.env['STRIVACITY_COOKIE_SECRET']` in server-only files (`src/server/*`). Never put it in `src/app/**` or `environment*.ts`, because those files are bundled for the browser.
- **v4 is a prerelease on the npm `next` dist-tag** (`4.0.0-beta.x`). A plain `npm install @strivacity/sdk-angular` installs v3, which has a different API. Install with `@next` or an explicit 4.x version and pin it exactly.
- **Two entry points.** Import everything for the browser and shared code from `@strivacity/sdk-angular`. It re-exports core flows, storages, errors, utils and types, so do not add `@strivacity/sdk-core`. Import `@strivacity/sdk-angular/server` (Express, `node:stream`) only from the SSR server files: `server.ts`, `app.config.server.ts` and modules that only they import.
- **Provide the SDK once, at the root**, with `provideStrivacity(config)` or `StrivacityAuthModule.forRoot(config)`. `StrivacityAuthService` creates the SDK in its constructor, so listing it in a component's `providers` creates a second SDK instance. `StrivacityNativeLoginService` is the opposite: provide it per component.
- **SSR:** `login()`, `register()`, `handleCallback()`, `logout()` and `injectScript()` need `window`. Call them only in the browser (`isPlatformBrowser(inject(PLATFORM_ID))`) or from click handlers.
- **Pick the mode first.** The quick start uses `mode: 'redirect'`. Mode-specific UI is covered by a separate mode reference loaded next to this one. Only `mode` and the login UI change between modes.

## Prerequisites

- Angular `>=20` (the `@angular/core` peer dependency). The code below uses signals, the `REQUEST` / `RESPONSE_INIT` tokens and `RedirectCommand`.
- Server-managed sessions only: `@angular/ssr` with its Express server (`ng add @angular/ssr`) and Express `>=5` (optional peer dependency).
- A Strivacity application in the Admin Console:
  - `redirect` / `popup` mode: client type **"OIDC using no-code components"**.
  - `embedded` / `native` mode: client type **"OIDC using the Journey Flow API"**.
- Registered on that client: the redirect URI, for example `http://localhost:4200/callback`, and every `postLogoutRedirectUri` you use (server-managed default: the origin of `redirectUri`).
- The issuer URL (`https://<your-cluster-domain>`) and the client ID.

## When NOT to use

- AngularJS (1.x): not supported.
- Nuxt, Vue, React, Next.js and other frameworks: use the matching framework integration.
- An Angular SSR server that is not Express (Fastify, edge runtimes with `AngularAppEngine`): `handlers` is an Express `Router`, and `createServerSDK` imports `express` even if you never mount it. Use `serverSdk.handler(webRequest)` instead. It returns a Web `Response`, or `null` for non-auth paths.
- A separate Express BFF that serves an Angular SPA: use the server-session reference. In the Angular app, `serverSessionUri` then points at that BFF.

## Quick start

### 1. Install

```bash
npm install @strivacity/sdk-angular@next
# or pin the exact version you tested, e.g.
npm install --save-exact @strivacity/sdk-angular@4.0.0-beta.1
```

### 2. Configuration

The Angular CLI has no client env-variable convention. The client options are public identifiers, so keep them in a TypeScript file. Use `environment*.ts` with `fileReplacements` if they differ per environment.

```ts
// src/app/auth.config.ts
import type { SDKInitConfig } from '@strivacity/sdk-angular';

export const authConfig: SDKInitConfig = {
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native' - chosen separately
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'http://localhost:4200/callback',
	scopes: ['openid', 'profile', 'email'],
	// serverSessionUri: '/auth/login', // server-managed sessions with Angular SSR, see "SSR with server-managed sessions"
};
```

### 3. Provide the SDK

```ts
// src/app/app.config.ts
import type { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStrivacity } from '@strivacity/sdk-angular';
import { authConfig } from './auth.config';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [provideRouter(routes), provideStrivacity(authConfig)],
};
```

For `NgModule` bootstrap, add `StrivacityAuthModule.forRoot(authConfig)` to the root module's `imports`. It registers the same providers.

### 4. Login, register, logout UI

Every page below handles both session strategies. Keep only the branch that matches your `serverSessionUri`. The helper performs a full-page redirect that also works during SSR (a real HTTP 302):

```ts
// src/app/auth/hard-redirect.ts
import { PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Call in an injection context (field initializer or constructor). */
export function injectHardRedirect(): (url: string) => void {
	const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	const responseInit = inject(RESPONSE_INIT, { optional: true }); // null outside SSR

	return (url) => {
		if (isBrowser) {
			globalThis.location.href = url;
		} else if (responseInit) {
			responseInit.status = 302;
			responseInit.headers = new Headers({ Location: url });
		}
	};
}
```

```ts
// src/app/auth/auth-header.ts
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-auth-header',
	imports: [RouterLink],
	template: `
		@if (auth.loading()) {
			<span>Loading...</span>
		} @else if (auth.isAuthenticated()) {
			<span>Hello, {{ name() }}</span>
			<a routerLink="/profile">Profile</a>
			<button type="button" (click)="onLogout()">Log out</button>
		} @else {
			<button type="button" (click)="auth.login()">Log in</button>
			<button type="button" (click)="auth.register()">Sign up</button>
		}
	`,
})
export class AuthHeaderComponent {
	readonly auth = inject(StrivacityAuthService);
	readonly name = computed(() => this.auth.idTokenClaims()?.['given_name'] ?? this.auth.idTokenClaims()?.sub);

	onLogout(): void {
		if (this.auth.options.serverSessionUri) {
			globalThis.location.href = '/auth/logout'; // server clears the cookie, then IdP logout
		} else {
			void this.auth.logout({ postLogoutRedirectUri: globalThis.location.origin });
		}
	}
}
```

With `serverSessionUri` set, `login()` / `register()` navigate to the Server SDK route (`/auth/login?...`), so the same buttons work in both strategies. `logout()` does not: it never clears the server cookie, and without an ID token in the hydrated session it does not reach the IdP either, so link to `/auth/logout` instead.

### 5. Callback route

The route at `redirectUri` either exchanges the code in the browser (client-managed) or forwards the query string to `/auth/callback` (server-managed):

```ts
// src/app/pages/callback.page.ts
import { Component, PLATFORM_ID, inject, type OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { injectHardRedirect } from '../auth/hard-redirect';

@Component({ selector: 'app-callback-page', template: '<p>Logging in...</p>' })
export class CallbackPage implements OnInit {
	private readonly auth = inject(StrivacityAuthService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly redirect = injectHardRedirect();

	ngOnInit(): void {
		const params = this.route.snapshot.queryParams as Record<string, string>;

		if (this.auth.options.serverSessionUri) {
			this.redirect(`/auth/callback?${new URLSearchParams(params).toString()}`);
		} else if (this.isBrowser) {
			void this.complete(params);
		}
	}

	private async complete(params: Record<string, string>): Promise<void> {
		if (params['error']) {
			await this.router.navigate(['/error'], { queryParams: params });
			return;
		}

		try {
			// validates state, PKCE code exchange, ID token, stores session; resolves to the returnTo given to login()
			const { returnTo } = await this.auth.handleCallback();
			await this.router.navigateByUrl(returnTo ?? '/profile');
		} catch (error) {
			await this.router.navigate(['/error'], { queryParams: { error_description: error instanceof Error ? error.message : 'Login failed' } });
		}
	}
}
```

Popup mode needs this route too. Inside the popup, `handleCallback()` (or the server's `/auth/callback`) notifies the opener window.

### 6. Protected routes

The SDK ships no guard. Write a `CanActivateFn` that sends anonymous users to `/login?returnTo=...`:

```ts
// src/app/auth/auth.guard.ts
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RedirectCommand, Router, type CanActivateFn } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

export const authGuard: CanActivateFn = async (_route, state) => {
	// inject() only works before the first await
	const auth = inject(StrivacityAuthService);
	const router = inject(Router);
	const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	const { sdk } = auth;
	const serverManaged = !!sdk.options.serverSessionUri;

	// Client-managed tokens live in localStorage, which SSR cannot see. The browser re-runs the guard.
	if (!serverManaged && !isBrowser) {
		return true;
	}

	// Awaits init() itself. Server-managed: the browser never refreshes, so an expired session is just false
	if (await auth.checkAuthentication()) {
		return true;
	}

	// Server-managed, client-side navigation: the hydrated session expired while the tab stayed open. Send it through
	// the refresh route (`${authUrlPrefix}/refresh`), which rotates the cookie and comes back to the target URL.
	// During SSR the session was already refreshed.
	if (isBrowser && serverManaged && sdk.session) {
		await sdk.refresh({ returnTo: state.url });
		return false;
	}

	return new RedirectCommand(router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } }));
};
```

```ts
// src/app/pages/login.page.ts
import { Component, PLATFORM_ID, inject, type OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { injectHardRedirect } from '../auth/hard-redirect';

@Component({ selector: 'app-login-page', template: '<p>Redirecting to login...</p>' })
export class LoginPage implements OnInit {
	private readonly auth = inject(StrivacityAuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly redirect = injectHardRedirect();

	ngOnInit(): void {
		const returnTo = this.route.snapshot.queryParamMap.get('returnTo');

		if (this.auth.options.serverSessionUri) {
			// The Server SDK validates returnTo (same origin only) and redirects there after /auth/callback
			this.redirect(returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : '/auth/login');
		} else if (this.isBrowser) {
			// Kept with the login state (same origin only); handleCallback() on the callback page resolves to it
			void this.auth.login({ returnTo: returnTo ?? undefined });
		}
	}
}
```

Register the routes in `app.routes.ts`: `{ path: 'profile', component: ProfilePage, canActivate: [authGuard] }`, plus `login` (`LoginPage`), `callback` (`CallbackPage`) and an `error` page. Server SDK failures redirect to `/error?type=...&error=...&error_description=...`.

### 7. Reading claims and the access token

`StrivacityAuthService` exposes read-only signals: `loading`, `language`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired` and `accessTokenExpirationDate` (Unix seconds). Call them in templates (`auth.idTokenClaims()`). They update after every SDK event.

```ts
// src/app/pages/profile.page.ts
import { Component, inject } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-profile-page',
	imports: [DatePipe, JsonPipe],
	template: `
		<h1>{{ auth.idTokenClaims()?.['email'] }}</h1>
		<pre>{{ auth.idTokenClaims() | json }}</pre>
		<p>Access token expires at {{ (auth.accessTokenExpirationDate() ?? 0) * 1000 | date: 'medium' }}</p>
	`,
})
export class ProfilePage {
	readonly auth = inject(StrivacityAuthService);
}
```

For an outgoing request, read `auth.sdk.accessToken` right after `await auth.checkAuthentication()` (see Patterns). With client-managed sessions the raw ID token is `auth.sdk.session?.id_token`. With server-managed sessions the hydrated session has no ID token or refresh token, so `refreshToken()` is always `null` there.

### Other modes in Angular (summary)

- `popup`: same service. `await auth.login()` / `register()` resolve when the popup finishes, then navigate. Call them from a click handler. They reject with `PopupBlockedError` / `PopupClosedError`. Keep the `/callback` route.
- `embedded`: add `schemas: [CUSTOM_ELEMENTS_SCHEMA]` to the standalone component. Importing `StrivacityAuthModule` does not pass its schema to a standalone component. In `ngOnInit`, in the browser only, call ``injectScript('sty-components', `${auth.sdk.options.issuer}/assets/components/bundle.js`)``. Render `<sty-login [params]="params" [sessionId]="sessionId" [shortAppId]="shortAppId" [lang]="lang" (login)="..." (close)="..." (error)="...">`, plus optionally `<sty-notifications>` and `<sty-language-selector>`.
- `native`: add `providers: [StrivacityNativeLoginService]` to the login page component, and in the browser call `nativeLogin.start({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })` from `ngOnInit`. Render `state().forms` / `state().layout` yourself. Widget child components `inject(StrivacityNativeLoginService)` to get the same instance, because Angular has no `useNativeLoginContext()`. In `onFallback(error)`, set `location.href = error.url.toString()`.
- Entry links (password reset and similar) for embedded/native: client-managed apps add an `/entry` route that calls `auth.entry()` and forwards the returned `session_id`, `short_app_id` and `language` to `/login`. Server-managed apps let `/auth/entry` redirect to `loginPageUri` with those params.

## SSR with server-managed sessions (Express)

The Strivacity example app uses this setup by default. Tokens stay in an encrypted http-only cookie, and the Express server serves the auth routes. The pages above already contain the server branch.

1. Set `serverSessionUri: '/auth/login'` in `auth.config.ts`. The browser SDK never refreshes in this mode: `authGuard` (and `auth.sdk.refresh({ returnTo })`) send an expired session through the Server SDK refresh route at `` `${authUrlPrefix}/refresh` `` (client option, default `'/auth'`; set it only if the server SDK uses a different prefix).
2. Create the Server SDK lazily, as the example app does, so that importing the module has no side effects. `createServerSDK` throws `ConfigurationError: Missing SDK option: cookieSecret` when neither `cookieSecret` nor `storage` is set. Set `STRIVACITY_COOKIE_SECRET` everywhere the server bundle runs: `ng serve`, `ng build` (route extraction loads `app.config.server.ts`) and production.

```ts
// src/server/strivacity.ts
import type { AngularServerSDK } from '@strivacity/sdk-angular/server';
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { authConfig } from '../app/auth.config';

let serverSdk: AngularServerSDK | undefined;

export function getServerSdk(): AngularServerSDK {
	serverSdk ??= createServerSDK({
		...authConfig, // the client options, plus the server-only ones below
		cookieSecret: process.env['STRIVACITY_COOKIE_SECRET'], // openssl rand -base64 32
		postLoginRedirectUri: '/profile', // default: origin of redirectUri
		// postLogoutRedirectUri: '/', authUrlPrefix: '/auth', loginPageUri: '/login', cookieMaxAge: 2592000
	});

	return serverSdk;
}
```

`createServerSDK` does not modify the options object you pass in. Read resolved values, such as `authUrlPrefix`, from `serverSdk.options`.

3. Mount the router **before** Angular's handler and before any body parser. `POST /auth/backchannel-logout` reads the raw body.

```ts
// src/server.ts (generated by ng add @angular/ssr): add this right after `const app = express();`
import { getServerSdk } from './server/strivacity';

const serverSdk = getServerSdk();

// GET /auth/{login,register,callback,refresh,revoke,entry,logout} and POST /auth/backchannel-logout
app.use(serverSdk.options.authUrlPrefix, serverSdk.handlers);
// ...then the generated `app.use((req, res, next) => angularApp.handle(req)...)` and `export const reqHandler`
```

4. Hand the session to the app. `provideStrivacityServerSession` reads the cookie through Angular's `REQUEST` token, refreshes a near-expiry session (the rotated cookie goes into the rendered response through `RESPONSE_INIT`; a failed refresh hands over `null`), and stores the session in `TransferState`. `StrivacityAuthService` then hydrates from it on the server and in the browser, without a loading flash. It does nothing on prerendered routes, because they have no request, so render auth-dependent routes with `RenderMode.Server`.

```ts
// src/app/app.config.server.ts
import { mergeApplicationConfig, type ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes, RenderMode, type ServerRoute } from '@angular/ssr';
import { provideStrivacityServerSession } from '@strivacity/sdk-angular/server';
import { getServerSdk } from '../server/strivacity';
import { appConfig } from './app.config';

const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Server }];

export const config = mergeApplicationConfig(appConfig, {
	providers: [provideServerRendering(withRoutes(serverRoutes)), provideStrivacityServerSession(getServerSdk())],
});
```

Do not create Angular routes under `/auth`. Express answers those paths before Angular sees them. The IdP returns to `/callback`, which forwards to `/auth/callback`, which sets the cookie and redirects to `returnTo` or `postLoginRedirectUri`. Alternatively, register `http://localhost:4200/auth/callback` as `redirectUri` and drop the callback page.

**The browser sees the access token.** `TransferState` serializes the session into the HTML: claims, access token and expiry. `provideStrivacityServerSession` removes `refresh_token` and `id_token` first (`toClientSession`), so they stay in the http-only cookie. Every server render refreshes a near-expiry session (`getSession()` with the default `autoRefresh`). On client-side navigations the guard above refreshes through `/auth/refresh`, which reads the cookie.

## Common mistakes

| Mistake                                                                  | Fix                                                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install @strivacity/sdk-angular` installs v3                        | Install `@strivacity/sdk-angular@next` or an exact `4.x` version, and pin it                                                                     |
| `window is not defined` / `location is not defined` during SSR           | Run `login()` / `handleCallback()` / `logout()` / `injectScript()` only when `isPlatformBrowser(PLATFORM_ID)`                                    |
| `ng serve` / `ng build` crashes with `Missing SDK option: cookieSecret`  | Set `STRIVACITY_COOKIE_SECRET` in the environment of every command that loads the server bundle                                                  |
| `express` / `node:stream` errors in the browser build                    | `@strivacity/sdk-angular/server` was imported from browser code. Import it only from `server.ts`, `app.config.server.ts` and server modules      |
| 404 or Angular "Cannot match any routes" for `/auth/login`               | Mount `app.use(serverSdk.options.authUrlPrefix, serverSdk.handlers)` before the Angular handler. Use a full-page redirect, not `router.navigate` |
| `app.use(authConfig.authUrlPrefix!, ...)` mounts nothing                 | The client options have no `authUrlPrefix`. Read the resolved value from `serverSdk.options.authUrlPrefix`                                       |
| Logged-in user bounced to `/login` on full reload (client-managed + SSR) | The server cannot read `localStorage`. Let the guard pass on the server (see `authGuard`)                                                        |
| Logout seems to work, but the user is still signed in (server-managed)   | `logout()` does not clear the cookie. Navigate to `/auth/logout`                                                                                 |
| Back-channel logout returns `400 Failed to parse request body`           | A body parser (`express.json()` / `urlencoded()`) ran before `serverSdk.handlers`. Mount the router first                                        |
| Back-channel logout returns `501`                                        | The default encrypted-cookie storage cannot delete by `sid`. Use `createSessionIdCookieStorage(storageWithDeleteByLogoutToken)`                  |
| "State not found or expired" on `/auth/callback` in production           | Default login-state storage is in-process memory. With several instances, pass a shared `stateStorage` (Redis or similar)                        |
| Hosted page errors, or embedded/native fails to start                    | Client type must match mode: redirect/popup need "OIDC using no-code components"; embedded/native need "OIDC using the Journey Flow API"         |
| `redirect_uri` mismatch                                                  | `redirectUri` must exactly match the Admin Console entry (`ng serve` uses port 4200, the built SSR server defaults to 4000)                      |

## API quick reference

### `@strivacity/sdk-angular`

- `provideStrivacity(config: SDKInitConfig): Provider[]` / `StrivacityAuthModule.forRoot(config)` register the `STRIVACITY_SDK` token and `StrivacityAuthService`.
- `StrivacityAuthService`:
  - Properties: `sdk` (the flow instance: `RedirectFlow | PopupFlow | EmbeddedFlow | NativeFlow`) and `options` (the config you passed).
  - Signals: `loading`, `language`, `isAuthenticated`, `idTokenClaims`, `accessToken`, `refreshToken`, `accessTokenExpired`, `accessTokenExpirationDate`.
  - Methods: `init()`, `login(params?)`, `register(params?)`, `handleCallback(url?)`, `logout({ postLogoutRedirectUri }?)`, `refresh({ returnTo }?)` (server-managed: navigates to `` `${authUrlPrefix}/refresh` ``; `returnTo` defaults to the current URL), `revoke()`, `checkAuthentication({ autoRefresh }?)` (awaits `init()` first), `tokenExchange(params?)`, `entry(url?, params?)`, `subscribeToEvent(name, cb)`, `subscribeToAllEvents(cb)`.
- `StrivacityNativeLoginService` (provide per component):
  - `start({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })`.
  - Signals: `loading`, `state`, `forms`, `messages`.
  - Methods: `submitForm(formId, body?)`, `setFormValue(formId, widgetId, value)`, `setMessage(...)`, `triggerFallback(message?)`, `triggerClose()`.
- Also exported:
  - Helpers: `injectScript`, `createDefaultLogging`.
  - Storages: `createLocalStorage` (default), `createSessionStorage`, `createMemoryStorage`, `createIndexedDBStorage`, `createCacheAPIStorage`, `createWorkerStorage`.
  - Errors: `FallbackError`, `PopupBlockedError`, `PopupClosedError`, `OidcError`, and more.
  - All core types.

### `@strivacity/sdk-angular/server`

- `createServerSDK(config)`: client options plus `cookieSecret`, `storage` (default encrypted cookies), `stateStorage` (default in-memory), `authUrlPrefix` (`'/auth'`), `loginPageUri` (`'/login'`), `postLoginRedirectUri` / `postLogoutRedirectUri` (default: origin of `redirectUri`), `cookieMaxAge` (`2592000`) and `serverSessionUri` (default `` `${authUrlPrefix}/login` ``).
- `AngularServerSDK`:
  - `handlers` (Express `Router`) and `options` (resolved).
  - Session methods: `getSession(req?, { autoRefresh }?)` (refreshes a near-expiry session once per request unless `autoRefresh` is `false`, `null` when that fails; the cookie is only queued, so flush it as in Patterns), `updateSession(session, req?)`, `refreshSession(req?)`, `revokeSession(req?)`, `completeLogin(params, req?)`, `logout(postLogoutRedirectUri, req?)`, `getEntrySession(url)`.
  - Route handlers that return a Web `Response`: `handleLogin` / `handleRegister` / `handleCallback` / `handleRefresh` / `handleRevoke` / `handleEntry` / `handleLogout` / `handleBackChannelLogout(req)`, and `handler(req)`, which returns `Response | null`.
  - `req` is an Express request or a Web `Request`.
- `provideStrivacityServerSession(serverSdk | undefined)`, `toWebRequest(req)`, `applyResponse(response, res)`, `createSessionIdCookieStorage(storage, options?)`, `createServerMemoryStorage()` (testing only).
- Types: `AngularServerSDK`, `AngularServerSDKInitConfig`, `AngularServerStorage`, `AngularServerRequest`.

Route behaviour:

- `/auth/login` and `/auth/register` accept `returnTo` (same origin only), `prompt`, `display`, `login_hint`, `acr_values`, `ui_locales`, `audience`.
- `/auth/refresh` answers `302` to `returnTo`, otherwise `204`.
- `/auth/revoke` and `/auth/logout` answer `302`.
- `/auth/entry` answers `302` to `loginPageUri?session_id=&short_app_id=&language=`.
- `/auth/backchannel-logout` answers `200`, `400` or `501`.
- Failures redirect to `/error?type=&error=&error_description=`.

### Key SDK options and login params

Option defaults: `scopes` `['openid']`, `responseType` `'code'`, `responseMode` `'query'`, `storageTokenName` `'sty.session'` (also the cookie name), `autoRefresh` `true`, `refreshSkew` `60`, `lazyLoad` `false`, `serverSessionUri` `null` (client), `authUrlPrefix` `'/auth'` (server-managed `refresh()` and the guard navigate to `` `${authUrlPrefix}/refresh` ``), `discoveryDocumentCacheTTL` `3600`, `jwksCacheTTL` `600`, and no `logging`.

`login()` / `register()` params: `prompt`, `display`, `loginHint`, `acrValues[]`, `uiLocales[]` and `audiences[]`. Redirect mode adds `locationMethod` and `targetWindow`. Popup mode adds `popupWindowFeatures`, `popupWindowTarget` and `checkOrigin`.

## Patterns

### Call a protected API with the access token (client-managed)

```ts
// src/app/auth/auth.interceptor.ts  -> provideHttpClient(withInterceptors([authInterceptor]))
import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
	if (!req.url.startsWith('https://api.example.com/')) {
		return next(req);
	}

	const auth = inject(StrivacityAuthService);

	// checkAuthentication() refreshes first when the token is within refreshSkew of expiry
	return from(auth.checkAuthentication()).pipe(
		switchMap(() => {
			const token = auth.sdk.accessToken;
			return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
		}),
	);
};
```

Request the API audience at login (`login({ audiences: ['https://api.example.com'] })`).

### Server-side routes (server-managed)

Call your own Express routes instead of sending the token from the browser. Add them in `server.ts` after the auth router. `applyResponse` writes an SDK `Response` (status, headers, all `Set-Cookie` values, body) to Express. `toWebRequest(req)` converts the other way, for example for `serverSdk.handler(...)`.

```ts
import { applyResponse, flushSetCookies } from '@strivacity/sdk-angular/server';

app.get('/api/orders', async (req, res, next) => {
	try {
		// Refreshes a near-expiry session once per request (null when that fails) and queues the rotated cookie on req
		const session = await serverSdk.getSession(req);
		const cookies = flushSetCookies(req, new Response(null)).headers.getSetCookie();
		if (cookies.length) res.append('set-cookie', cookies);

		if (!session?.access_token) {
			res.status(401).json({ error: 'not_authenticated' });
			return;
		}
		const upstream = await fetch('https://api.example.com/orders', { headers: { Authorization: `Bearer ${session.access_token}` } });
		res.status(upstream.status).json(await upstream.json());
	} catch (error) {
		next(error);
	}
});

// A custom path for one SDK handler. A cross-origin returnTo throws ProtocolError, so forward errors to next()
app.get('/signin', (req, res, next) => {
	serverSdk
		.handleLogin(req)
		.then((response) => applyResponse(response, res))
		.catch(next);
});
```

### Token refresh and logout

- Client-managed: no background timer. `checkAuthentication()` (also called by the guard and the interceptor) refreshes once the token is within `refreshSkew` (60 s) of expiry and a refresh token exists. `refresh()` forces it. On failure `tokenRefreshFailed` fires and the session is cleared, unless the failure was a `NetworkError` / `ServerError`. A refresh token is only issued if the client and scopes allow it (often `offline_access`).
- Server-managed: the browser never refreshes. `provideStrivacityServerSession` refreshes a near-expiry session on every server render. In the browser, `auth.sdk.refresh({ returnTo })` navigates to `/auth/refresh?returnTo=...` (the guard above does this for an expired session). In an Express route, `await serverSdk.getSession(req)` (refresh only when needed) or `await serverSdk.refreshSession(req)` (always), then flush the cookies.
- Logout: `logout({ postLogoutRedirectUri })` (client) or `/auth/logout` (server). Both go to the IdP end-session endpoint. In `popup` mode `logout()` navigates the current window, it does not open a popup. `revoke()` / `/auth/revoke` revoke tokens without the IdP logout page.

### Events and back-channel logout

- Events: `auth.subscribeToEvent(name, cb)` returns `{ dispose() }`. Call `dispose()` in `inject(DestroyRef).onDestroy(...)`. Event names: `init`, `sessionLoaded`, `loginInitiated`, `flowInitiated`, `loggedIn`, `sessionUpdated`, `tokenRefreshed`, `tokenRefreshFailed`, `accessTokenExpired`, `tokenRevoked`, `tokenRevokeFailed`, `logoutInitiated`, `sessionCleared`. `accessTokenExpired` fires once, when `init()` loads a stored session whose access token has already expired.
- Back-channel logout: register `https://<your-app>/auth/backchannel-logout` on the client. Pass `storage: createSessionIdCookieStorage(yourStorage)` (from `@strivacity/sdk-angular/server`) to `createServerSDK`. `yourStorage` must implement `get` / `set` / `delete` / `deleteByLogoutToken`, for example backed by Redis.

Further reading: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-angular and https://docs.strivacity.com
