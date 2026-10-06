# Debugging Strivacity SDK errors

How to read an SDK error, turn on logging, and map a symptom to its cause. Find the row that matches the error message or symptom, then apply the fix. Check the configuration rows first: most login failures after a setup change are a mismatch between the app config and the client in the Strivacity Admin Console.

## Critical rules

- **Read the real error first.** Log `error.name`, `error.message` and, for `OidcError`, `error.error` / `error.errorDescription`. Do not replace them with a generic "login failed" while debugging.
- **Never log tokens, codes or the session object.** Log claims such as `sub` only if your privacy rules allow it. The built-in logger never prints tokens. Keep it that way in custom loggers.
- **Never "fix" an error by weakening security**: no `checkOrigin: false` on purpose, no `SameSite=None` without need, no tokens in query strings, no disabled `aud` checks in your API.
- **Do not read `.env` files** to debug. Ask the user to confirm the values (issuer, client ID, redirect URI, mode) instead.

## Error classes

All classes are exported from every wrapper (`@strivacity/sdk-react`, `@strivacity/sdk-vue`, `@strivacity/sdk-angular`, `@strivacity/sdk-preact`, `@strivacity/sdk-next/client`, `@strivacity/sdk-svelte/client`, `@strivacity/sdk-solid/client`, `@strivacity/sdk-nuxt/utils`) and from `@strivacity/sdk-core/utils` (or `@strivacity/sdk-core/utils/errors`).

| Class                  | `category`         | `recoverable` | Thrown when                                                                                                                                                                                                                      |
| ---------------------- | ------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OidcError`            | `'Oidc'`           | `false`       | The IdP returned an OAuth error: `?error=` on the callback, a `{ error }` body from the token / revocation endpoint, or an error from the entry endpoint. Fields: `error`, `errorDescription`, `errorUri`                        |
| `ProtocolError`        | `'Protocol'`       | `false`       | A response broke the protocol: missing or unknown `state`, missing `code`, ID token checks, discovery document problems, duplicate callback params, non-JSON token responses, invalid redirect URI in embedded / native finalize |
| `NetworkError`         | `'Network'`        | `true`        | `fetch` itself threw: offline, DNS, TLS, blocked by CORS or an ad blocker. Message: `Network request failed: <origin><path>`                                                                                                     |
| `ServerError`          | `'Server'`         | `true`        | HTTP `429` or `5xx` from the token, revocation or flow endpoints, and **any** non-OK status from the discovery document or JWKS. Field: `status`                                                                                 |
| `ConfigurationError`   | `'InvalidRequest'` | `false`       | Missing `issuer`, `clientId` or `redirectUri`, `scopes` not an array, Server SDK without `secret` and `storage`, server refresh without a refresh token                                                                          |
| `InternalError`        | `'Internal'`       | `false`       | Server adapter passed a non-object event (`Server adapter events must be objects to track outgoing cookies`)                                                                                                                     |
| `UnsupportedFlowError` | none               | none          | `initFlow()` got a `mode` other than `redirect`, `popup`, `embedded`, `native` (often `undefined` from a missing env var)                                                                                                        |
| `PopupBlockedError`    | none               | none          | `window.open` returned `null`                                                                                                                                                                                                    |
| `PopupClosedError`     | none               | none          | The pop-up was closed before it posted a result (checked every 500 ms)                                                                                                                                                           |
| `SessionExpiredError`  | none               | none          | Native mode: the flow API answered `403` to a form submit (the login session timed out)                                                                                                                                          |
| `FallbackError`        | none               | none          | Native mode: the flow API wants the hosted UI. Field: `url` (the `hostedUrl`). `useNativeLogin` routes it to `onFallback` instead of `onError`                                                                                   |

`FailureCategory` is `'Network' | 'Server' | 'Oidc' | 'Protocol' | 'InvalidRequest' | 'Internal' | 'Unknown'`. Only the first six classes carry it.

```ts
// src/auth/describe-error.ts - one place that turns SDK errors into UI decisions
import { NetworkError, OidcError, PopupBlockedError, PopupClosedError, ServerError, type FailureCategory } from '@strivacity/sdk-react';

export type AuthErrorView = { retry: boolean; message: string; category: FailureCategory };

export function describeAuthError(error: unknown): AuthErrorView {
	if (error instanceof PopupBlockedError) return { retry: true, message: 'Allow pop-ups for this site and try again.', category: 'Unknown' };
	if (error instanceof PopupClosedError) return { retry: true, message: 'The login window was closed.', category: 'Unknown' };
	if (error instanceof NetworkError || error instanceof ServerError)
		return { retry: true, message: 'Service unavailable, try again.', category: error.category };
	if (error instanceof OidcError) return { retry: false, message: error.errorDescription ?? error.error, category: error.category };

	const category = error instanceof Error && 'category' in error ? (error.category as FailureCategory) : 'Unknown';

	return { retry: false, message: error instanceof Error ? error.message : 'Unknown error', category };
}
```

If `instanceof` is unexpectedly `false`, two copies of `@strivacity/sdk-core` are installed (mixed versions). Align the `@strivacity/sdk-*` versions, or compare `error.name` as a stopgap.

## Turn on logging

Pass a logger. `createDefaultLogging()` writes to the console. Debug lines include every SDK request as `REQUEST [METHOD]: <origin><path>` (no query string) and the `X-Event-ID` correlation ID from Strivacity responses. Include that ID when you contact Strivacity support.

| Stack                                                  | Where                                                                                                                                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React, Preact, Solid, Next.js client, Svelte           | `options={{ ...options, logging: createDefaultLogging() }}` on the provider (`createStyAuthProvider({ options })` in Svelte)                                                  |
| Vue / Angular                                          | `createStrivacitySDK({ ..., logging: createDefaultLogging() })` / `provideStrivacity({ ..., logging: createDefaultLogging() })`                                               |
| Nuxt                                                   | `strivacity: { loggingFactoryPath: '~/lib/auth/logging' }` in `nuxt.config.ts`; that file does `export { createDefaultLogging as default } from '@strivacity/sdk-nuxt/utils'` |
| Server SDK (`createServerSDK` / `createBaseServerSDK`) | `logging: createDefaultLogging()` in the server options                                                                                                                       |

```ts
// React example: debug logging only in development builds
import { createDefaultLogging, type SDKInitConfig } from '@strivacity/sdk-react';

export const options: SDKInitConfig = {
	mode: 'redirect',
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'http://localhost:5173/callback',
	scopes: ['openid', 'profile'],
	logging: import.meta.env.DEV ? createDefaultLogging() : undefined,
};
```

A custom logger implements `SDKLogging` (`debug`, `info`, `warn`, `error(message, error)` and an optional `xEventId` field). Do not add request bodies, headers or session data to it.

## Debugging order

1. **Configuration.** Confirm with the user: `issuer` (bare `https://<your-cluster-domain>`), `clientId`, `redirectUri` (registered exactly), `mode` vs client type, `scopes` (an array that contains `openid`).
2. **Discovery.** `https://<your-cluster-domain>/.well-known/openid-configuration` must load and its `issuer` must equal the `issuer` option.
3. **Logging.** Enable `createDefaultLogging()` and reproduce. The last `REQUEST [...]` line before the error shows which step failed (authorize, token, JWKS, flow API).
4. **Network tab.** Look at the failing request's status and JSON body. Token endpoint errors become `OidcError` with the server's `error` code.
5. **Session strategy.** Is `serverSessionUri` set? In BFF mode the browser SDK holds no tokens, and errors appear on the app's `/error` route instead of in a rejected promise.

## Inspect what the SDK stored

- Client-managed session: the session is JSON under `storageTokenName` (default `'sty.session'`) in `storage` (default `localStorage`). In-progress logins are `sty.<state id>` entries in `stateStorage` (default `sessionStorage`). An empty `sessionStorage` on the callback page explains a state error.
- `sdk.idTokenClaims` shows `iss`, `aud`, `exp` and `sub` of the ID token. To look at an access token while debugging, `decodeJwt(sdk.accessToken)` (exported by every wrapper) shows its `aud` and `exp`. It does not verify anything, so never use it for authorization decisions.
- BFF: cookies `sty.session` (or `sty.session.0`, `sty.session.1`, ... when chunked) and `sty.returnTo`. They are encrypted, so you can only check that they exist and are sent with the request.

## Keep the real error on the callback page

```tsx
// React callback page (client-managed session): show the SDK's message instead of a generic one
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { OidcError, useStrivacity } from '@strivacity/sdk-react';

export default function Callback() {
	const { loading, handleCallback } = useStrivacity();
	const navigate = useNavigate();
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		if (loading) return;

		handleCallback()
			.then(() => navigate('/profile', { replace: true }))
			.catch((error: unknown) => {
				// OidcError covers ?error=...&error_description=... returned by the IdP
				setMessage(error instanceof OidcError ? (error.errorDescription ?? error.error) : (error as Error).message);
			});
	}, [loading]);

	return <p role={message ? 'alert' : undefined}>{message ?? 'Logging in...'}</p>;
}
```

Vue, Angular, Svelte, Solid and Nuxt use the same logic with their own `handleCallback` (`useStrivacity()`, or `inject(StrivacityAuthService)` in Angular). In popup mode do not branch on `?error=` before calling `handleCallback()`: it forwards the error to the opener, where `login()` rejects.

## Symptom → cause → fix

### Configuration and startup

| Symptom                                                                                                                | Likely cause                                                                                                                                                                                                     | Fix                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UnsupportedFlowError: Unsupported flow mode`                                                                          | `mode` is missing or misspelled (env var not loaded, wrong prefix such as `VITE_`)                                                                                                                               | Pass one of the four modes. Check that the bundler exposes the env var                                                                                           |
| `ConfigurationError: Missing option: issuer` / `clientId` / `redirectUri`                                              | Value is empty at runtime                                                                                                                                                                                        | Same as above. The check runs in `init()`, so it surfaces on the first SDK call                                                                                  |
| `ConfigurationError: Invalid option: scopes`                                                                           | `scopes: 'openid profile'` (a string)                                                                                                                                                                            | `scopes: ['openid', 'profile']`                                                                                                                                  |
| `ConfigurationError: Missing SDK option: secret` (Next.js and Nuxt: `Secret is required for encrypted cookie storage`) | Server SDK has neither `secret` nor a custom `storage`                                                                                                                                                           | Set a server-only secret (`openssl rand -base64 32`)                                                                                                             |
| Nuxt: pages and `/auth/*` routes answer `500 Strivacity SDK failed to initialize`                                      | The Server SDK failed to start. The server log shows `[@strivacity/sdk-nuxt] Failed to initialize the Strivacity server SDK:` with the cause (often the missing `secret` above, or a factory module that throws) | Fix the logged cause and restart                                                                                                                                 |
| Nuxt: `[@strivacity/sdk-nuxt] login() is only available in the browser. During SSR, useStrivacity() is read-only.`     | An SDK method (`login()`, `logout()`, `handleCallback()`, `sdk.*`, ...) ran during server-side rendering, for example in `<script setup>` top-level code                                                         | Call it from `onMounted()` or an event handler. During SSR only the refs, `sdk.options` and `sdk.session` can be read                                            |
| `ServerError: Failed to fetch OIDC metadata` (`status` 404 and so on)                                                  | Wrong `issuer` (typo, extra path, wrong cluster)                                                                                                                                                                 | `issuer` is the bare tenant URL `https://<your-cluster-domain>`. `/.well-known/openid-configuration` must load in a browser                                      |
| `ProtocolError: Discovery document issuer mismatch: expected ..., got ...`                                             | `issuer` differs from the `issuer` in the discovery document (a trailing slash is tolerated)                                                                                                                     | Copy the `issuer` value from the discovery document                                                                                                              |
| `ProtocolError: Discovery document field "..." must be an https:// URL on <host>`                                      | Endpoints point at another host, for example a custom domain while `issuer` uses the default one                                                                                                                 | Use the domain the discovery document uses for its endpoints                                                                                                     |
| `NetworkError: Network request failed: https://<your-cluster-domain>/...`                                              | Offline, DNS, corporate proxy, ad blocker, or a CORS rejection (the browser console shows the CORS line)                                                                                                         | Open the URL in the browser. For CORS, check that your app origin is allowed for the client in the Admin Console                                                 |
| `Error: Missing SDK context`                                                                                           | `useStrivacity()` called outside the provider / plugin                                                                                                                                                           | Wrap the tree in `StyAuthProvider` (React, Preact, Solid, Next), install `createStrivacitySDK` (Vue) or call `createStyAuthProvider` in the root layout (Svelte) |

### Login start and the hosted page

| Symptom                                                                              | Likely cause                                                                                    | Fix                                                                                                                         |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Strivacity shows an error about the redirect URI instead of the login page           | `redirectUri` is not registered on the client (scheme, port, path and trailing slash all count) | Register the exact value. The IdP cannot redirect back to an unregistered URI, so the app never sees this error             |
| Login worked, then broke right after changing `mode`                                 | Client type does not fit the mode                                                               | `redirect` / `popup` need **OIDC using no-code components**. `embedded` / `native` need **OIDC using the Journey Flow API** |
| `OidcError: invalid_scope`, `unauthorized_client`, `invalid_request` on the callback | Scope, grant or parameter not enabled for this client                                           | Enable it on the client, or remove it from `scopes` / login params                                                          |
| `ProtocolError: Discovery document does not advertise S256 PKCE support`             | Unexpected IdP metadata (proxy rewriting it, wrong issuer)                                      | Point `issuer` at Strivacity directly                                                                                       |
| BFF: `login()` lands on a 404 or the SPA's `index.html`                              | `serverSessionUri` is a string, but no backend route or dev proxy serves it                     | Mount the Server SDK routes and proxy `/auth` to the backend, or set `serverSessionUri: null` for a client-managed session  |
| BFF: 500 from `/auth/login` with `Invalid returnTo URL`                              | `returnTo` is absolute or points to another origin. The route throws instead of redirecting     | Pass a same-origin path such as `?returnTo=/orders`                                                                         |

### Callback

| Symptom                                                                                                    | Likely cause                                                                                                                                                                                                                                                                                                                                             | Fix                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Callback URL has `?error=access_denied&error_description=...`; `handleCallback()` rejects with `OidcError` | The user cancelled, or a journey policy denied access                                                                                                                                                                                                                                                                                                    | Show `errorDescription` and offer to log in again. Do not retry automatically                                                                                                                                                                        |
| `ProtocolError: Invalid or missing state` (client)                                                         | The `sty.<state>` entry is not in `stateStorage`: the callback page was reloaded (the entry is deleted on first use, and also when the callback carries `?error=`), the login started in another tab (default `stateStorage` is `sessionStorage`, per tab), storage was cleared, or `stateStorage` is a memory storage that did not survive the redirect | Navigate away after `handleCallback()` (`location.replace` / router `replace`). If logins legitimately finish in another tab (email links), use `stateStorage: createLocalStorage()`. Never use memory storage for `stateStorage` in `redirect` mode |
| `ProtocolError: State not found or expired. Please try logging in again.` (BFF `/error` page)              | Default server `stateStorage` is an in-memory `Map` per process: several instances, serverless, or a restart between login and callback. Or the browser SDK called `handleCallback()` in BFF mode                                                                                                                                                        | Use a shared `stateStorage` (Redis, KV). Forward `/callback` to `/auth/callback` with the query string instead of calling `handleCallback()`                                                                                                         |
| `ProtocolError: Invalid or missing authorization code`                                                     | Callback reached without `code` (bookmarked `/callback`, `responseMode` mismatch)                                                                                                                                                                                                                                                                        | Keep `responseMode` at the default `'query'` unless you also read the fragment                                                                                                                                                                       |
| `ProtocolError: Duplicate parameter in redirect callback: <name>`                                          | A proxy or the app appended a parameter that the IdP also sent                                                                                                                                                                                                                                                                                           | Do not modify the callback URL                                                                                                                                                                                                                       |
| `OidcError: invalid_grant` from the token endpoint                                                         | Code already used (double exchange from two SDK instances), expired, or `redirect_uri` differs between the authorize and token requests                                                                                                                                                                                                                  | Create one SDK instance. Use the same `redirectUri` everywhere (browser and Server SDK)                                                                                                                                                              |
| `ProtocolError: Token has expired` right after login                                                       | ID token `exp` is checked against the local clock with 60 s leeway. The device clock is ahead by more than the ID token lifetime plus 60 s                                                                                                                                                                                                               | Fix the device or server clock (NTP). The access token expiry itself is computed from `expires_in`, so it does not depend on clock skew                                                                                                              |
| `ProtocolError: Invalid aud` / `Invalid iss` / `Invalid nonce`                                             | `clientId` differs from the client that issued the token, `issuer` points elsewhere, or the state entry belongs to another login attempt                                                                                                                                                                                                                 | Use one client ID per app on both sides, and do not run two logins in parallel in the same tab                                                                                                                                                       |
| `ProtocolError: Missing access_token` / `Unsupported token_type: ...`                                      | The token response has no access token, or it is not a `Bearer` token                                                                                                                                                                                                                                                                                    | Check the client's grant and token settings in the Admin Console                                                                                                                                                                                     |

### Popup mode

| Symptom                                                   | Likely cause                                                                                           | Fix                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PopupBlockedError: Popup window blocked`                 | `login()` not called directly from a click (called on mount, or after a slow `await`)                  | Call it in the click handler. Catch the error and offer a button or a `redirect` fallback                                                     |
| `PopupClosedError: Popup closed by user` on every attempt | The callback page in the pop-up never calls `handleCallback()`, or it redirects to an error page first | `handleCallback()` must run in the pop-up for success and `?error=` responses alike                                                           |
| Pop-up shows the app instead of closing                   | No route at `redirectUri`, or the route renders the app shell without calling `handleCallback()`       | Add the callback page                                                                                                                         |
| `logout()` in popup mode navigates the whole page away    | Expected: popup-mode `logout()` uses a full-page redirect to the end-session endpoint, not a pop-up    | Pass a registered `postLogoutRedirectUri` so the user comes back. Use `revoke()` to sign out without leaving the page (the IdP session stays) |

### Embedded and native modes

| Symptom                                                                     | Likely cause                                                                                                           | Fix                                                                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `onFallback` called with a `FallbackError`                                  | The journey contains a step that the native renderer does not support, or the flow API returned a 4xx without messages | Redirect: `onFallback: (error) => { window.location.href = error.url.toString(); }`. This continues the same journey on the hosted page |
| `SessionExpiredError: Session expired` on submit                            | The login session timed out (HTTP 403)                                                                                 | Restart with `startSession()` (remount the login page)                                                                                  |
| `ProtocolError: Invalid redirect URI` after the last screen                 | The IdP's final redirect does not start with `redirectUri`                                                             | Use the exact registered `redirectUri`                                                                                                  |
| `ProtocolError: Neither "code" nor "session_id" is present in the response` | The client is a no-code client, not a Journey Flow API client                                                          | Switch the client type, or use `redirect` / `popup`                                                                                     |
| `Error: Session ID is missing. Cannot submit form.`                         | `submitForm()` before the session started                                                                              | Wait for `loading` to become `false`                                                                                                    |

### Tokens and refresh

| Symptom                                                                                                                  | Likely cause                                                                                                                                                                                                                                  | Fix                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokenRefreshFailed` event, then the user is logged out                                                                  | Refresh rejected (`OidcError: invalid_grant`, `ProtocolError`): refresh token expired, revoked, or rotated by another tab. The client SDK clears the session for every error except `NetworkError` / `ServerError`                            | Subscribe to `sessionCleared` / `tokenRefreshFailed` and send the user to login. With refresh-token rotation, avoid several tabs refreshing the same `localStorage` session |
| `tokenRefreshFailed`, but the session is still there                                                                     | Transient `NetworkError` / `ServerError`. The session is kept on purpose                                                                                                                                                                      | Retry later. `checkAuthentication()` returns `false` for this call                                                                                                          |
| `ProtocolError: Invalid sub` after a refresh                                                                             | The refreshed ID token belongs to another user                                                                                                                                                                                                | Treat as a security event: clear the session and log in again                                                                                                               |
| Access token expired although `autoRefresh` is `true`                                                                    | There is no refresh timer. Refresh happens only inside `checkAuthentication()` (also behind `isAuthenticated`, the wrappers' state updates and the route guards)                                                                              | `await sdk.checkAuthentication()` before using `sdk.accessToken`, or schedule it from `accessTokenExpirationDate`                                                           |
| `refresh()` does nothing                                                                                                 | No refresh token in the session                                                                                                                                                                                                               | A refresh token is only issued if the client and scopes allow it (often `offline_access`)                                                                                   |
| `refresh()` or the guard lands on a 404 (BFF)                                                                            | With `serverSessionUri` set the browser never refreshes: it navigates to `` `${authUrlPrefix}/refresh` ``, and the client `authUrlPrefix` (default `'/auth'`) does not match the Server SDK prefix, or that path is not proxied to the server | Set the same `authUrlPrefix` on the client and the Server SDK, and route that prefix to the server                                                                          |
| BFF `/auth/refresh` → `/error?type=invalidrequest&error=ConfigurationError&error_description=No refresh token available` | Same, on the server. Separately, when the refresh request itself fails, the server clears the cookie for **every** error, including network errors                                                                                            | Request the scope, or log in again                                                                                                                                          |
| API returns `401` with a valid-looking token                                                                             | Token was not issued for that API (`aud`)                                                                                                                                                                                                     | Request it with `audiences` in the login params                                                                                                                             |

### Server-managed sessions (BFF)

| Symptom                                                                                                 | Likely cause                                                                                                                                              | Fix                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login completes, but the session endpoint returns no session                                            | Cookie not sent: SPA and BFF on different sites, `fetch` without `credentials: 'include'`, or plain `http` on a non-localhost host (cookies are `Secure`) | Serve `/auth` from the app origin through a proxy. Otherwise CORS with `credentials: true` and `fetch(..., { credentials: 'include' })`. Use HTTPS                     |
| Cross-site BFF: cookies never arrive                                                                    | Default cookies are `SameSite=Lax`                                                                                                                        | Prefer the same origin. Otherwise a custom `createEncryptedCookieStorage(..., { defaultCookieOptions: { sameSite: 'none' } })`, and expect third-party-cookie blocking |
| Redirects go to `http://` or the backend port                                                           | Dev proxy rewrites `Host` (`changeOrigin: true`), or `trust proxy` is not set behind TLS                                                                  | Keep the `Host` header. Express: `app.set('trust proxy', 1)`                                                                                                           |
| Random logouts across instances                                                                         | `secret` differs between instances, or was rotated                                                                                                        | Share one secret                                                                                                                                                       |
| `POST /auth/backchannel-logout` → `501 Back-channel logout requires a storage with deleteByLogoutToken` | Default encrypted-cookie storage cannot delete a session by `sid` / `sub`, or the `createSessionIdCookieStorage` store has no `deleteByLogoutToken`       | Use `createSessionIdCookieStorage(adapter, store)` with a store that implements `deleteByLogoutToken`                                                                  |
| Back-channel logout → `400 Failed to parse request body`                                                | A body parser consumed the request first                                                                                                                  | Mount the auth routes before `express.urlencoded()`                                                                                                                    |
| Back-channel logout → `400 Invalid logout_token: invalid or stale iat claim`                            | Server clock is off by more than 120 s                                                                                                                    | Sync the server clock                                                                                                                                                  |
| `InternalError: Server adapter events must be objects to track outgoing cookies`                        | Custom adapter passes a string or `undefined` as the event                                                                                                | Pass the framework's request object                                                                                                                                    |

The Server SDK routes (`callback`, `refresh`, `revoke`, `entry`, `logout`) redirect failures to `{request origin}/error`:

- `OidcError`: `?type=oidc&error=<oauth error>&error_description=<text>`
- other SDK errors: `?type=<category in lower case>&error=<class name>&error_description=<message>`, for example `type=protocol&error=ProtocolError`
- anything else: `?type=unknown&error=unknown_error&error_description=<message>`

Render `error_description` (text only, never as HTML) on the app's `/error` route.

### Logout

| Symptom                                                 | Likely cause                                                            | Fix                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| User stays on the Strivacity "logged out" page          | `postLogoutRedirectUri` not passed or not registered on the client      | `logout({ postLogoutRedirectUri: window.location.origin })` and register that URI |
| `logout()` returns without redirecting                  | No ID token in the session (already cleared, or `openid` scope missing) | Keep `openid` in `scopes`. The local session is cleared either way                |
| BFF: user still logged in after `logout()` / `revoke()` | The client SDK holds no tokens in BFF mode                              | Navigate to `/auth/logout` or `/auth/revoke`                                      |
| Next login skips the login form after `revoke()`        | `revoke()` ends only the tokens, not the IdP session                    | Use `logout()` to end the IdP session                                             |

More detail: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core (Error handling section) and https://docs.strivacity.com/reference/overview
