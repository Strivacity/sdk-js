# Strivacity Core (vanilla JS/TS and Node.js servers)

Use `@strivacity/sdk-core` v4 directly: in a browser app without a Strivacity framework wrapper (vanilla JS/TS, Lit, Alpine, plain web components, or any UI library), and on Node.js-style servers (Express, Fastify, Hono, Bun, Deno) through the Server SDK in `@strivacity/sdk-core/server`.

## Critical rules

- **Ask before creating or editing `.env` files**, and never read an existing `.env` / `.env.local` into context without explicit permission. Tell the user which variables to add instead.
- **Browser code is a public PKCE client.** Never put a client secret, or the Server SDK `cookieSecret`, in browser code or in a `VITE_` / `PUBLIC_` variable.
- **v4 is a prerelease on the npm `next` dist-tag** (`4.0.0-beta.x`). `npm install @strivacity/sdk-core` without a tag installs v3, which has a different, class-based API. Install with `@next` or an exact 4.x version and pin it.
- **Pass the flow type to `initFlow`.** Write `initFlow<RedirectFlow>({ mode: 'redirect', ... })`. Without the type argument TypeScript types the result as `unknown`, even though the runtime object is correct.
- **Create the SDK once, in one module, and import that instance everywhere.** Each `initFlow()` call creates an independent flow with its own session state and event subscribers.
- **Await an async check before reading auth state synchronously.** `initFlow()` returns the flow synchronously, and session loading from storage is asynchronous. `checkAuthentication()`, `isAuthenticated`, `login()`, `handleCallback()`, `refresh()`, `revoke()`, `logout()` and `entry()` await `init()` themselves, also with `lazyLoad: true`. The synchronous getters (`accessToken`, `idTokenClaims`, `isAuthenticatedSync`, `session`) read memory and are empty until `init()` has finished, so read them after `await sdk.checkAuthentication()` (or `await sdk.init()`).
- **`mode` is required** and must match the client type in the Strivacity Admin Console. A missing or unknown `mode` throws `UnsupportedFlowError: Unsupported flow mode`.

## Prerequisites

- A browser app with a bundler that resolves package `exports` (Vite, webpack 5, esbuild, Rollup). For the Server SDK: a runtime with Fetch API `Request` / `Response` and Web Crypto (Node.js 20+, Bun, Deno, Workers).
- A Strivacity application in the Admin Console:
  - `redirect` / `popup` mode: client type **"OIDC using no-code components"**.
  - `embedded` / `native` mode: client type **"OIDC using the Journey Flow API"**.
- The exact redirect URI (for example `http://localhost:5173/callback`) registered on that client, plus any post-logout redirect URI you pass to `logout()`.
- The issuer `https://<your-cluster-domain>` and the client ID `<your-client-id>`.

## When NOT to use

- If the project uses React, Next.js, Vue, Nuxt, Angular, Preact, Solid / SolidStart or Svelte / SvelteKit, use that wrapper (`@strivacity/sdk-react`, `-next`, `-vue`, `-nuxt`, `-angular`, `-preact`, `-solid`, `-svelte`). Each re-exports the core API and adds reactive state, guards and native-login helpers. Do not add `@strivacity/sdk-core` next to a wrapper.
- Next.js, Nuxt, SvelteKit, SolidStart and Angular SSR have their own server entry points (`createServerSDK`). Use `createBaseServerSDK` only for a standalone Node server or a framework without a wrapper.
- React Native and other non-browser mobile runtimes are not covered.

## Quick start (browser, redirect mode)

### 1. Install

```bash
npm install --save-exact @strivacity/sdk-core@next
```

### 2. Configuration

Ask the user before writing these. None of them is cookieSecret:

```bash
# .env.local (Vite)
VITE_STRIVACITY_ISSUER="https://<your-cluster-domain>"
VITE_STRIVACITY_CLIENT_ID="<your-client-id>"
VITE_STRIVACITY_REDIRECT_URI="http://localhost:5173/callback"
```

### 3. One SDK instance

```ts
// src/sdk.ts
import { initFlow } from '@strivacity/sdk-core';
import type { RedirectFlow } from '@strivacity/sdk-core';

export const sdk = initFlow<RedirectFlow>({
	mode: 'redirect', // 'redirect' | 'popup' | 'embedded' | 'native'
	issuer: import.meta.env.VITE_STRIVACITY_ISSUER, // https://<your-cluster-domain>
	clientId: import.meta.env.VITE_STRIVACITY_CLIENT_ID,
	redirectUri: import.meta.env.VITE_STRIVACITY_REDIRECT_URI,
	scopes: ['openid', 'profile', 'email'],
});
```

For another mode, change both `mode` and the type argument: `PopupFlow`, `EmbeddedFlow` or `NativeFlow`.

### 4. Login, register, logout and auth state

```ts
// src/main.ts
import { sdk } from './sdk';

const status = document.querySelector<HTMLElement>('#status')!;
const loginButton = document.querySelector<HTMLButtonElement>('#login')!;
const registerButton = document.querySelector<HTMLButtonElement>('#register')!;
const logoutButton = document.querySelector<HTMLButtonElement>('#logout')!;

async function render(): Promise<void> {
	const authenticated = await sdk.checkAuthentication(); // loads the stored session first, refreshes if the token is about to expire

	status.textContent = authenticated ? `Hello, ${sdk.idTokenClaims?.given_name ?? sdk.idTokenClaims?.sub}` : 'Signed out';
	loginButton.hidden = registerButton.hidden = authenticated;
	logoutButton.hidden = !authenticated;
}

loginButton.addEventListener('click', () => void sdk.login());
registerButton.addEventListener('click', () => void sdk.register()); // login() with prompt: 'create'
logoutButton.addEventListener('click', () => void sdk.logout({ postLogoutRedirectUri: window.location.origin }));

sdk.subscribeToEvent('sessionUpdated', () => void render());
sdk.subscribeToEvent('sessionCleared', () => void render());
void render();
```

### 5. Callback page

The page at `redirectUri` must call `handleCallback()`. It reads the query, checks `state`, exchanges the code with PKCE, verifies the ID token and stores the session. Popup mode needs this page too: inside the popup it posts the result to the opener.

```ts
// src/callback.ts (loaded by the page served at /callback)
import { sdk } from './sdk';

const params = new URLSearchParams(window.location.search);

if (params.has('error')) {
	window.location.replace(`/?error=${encodeURIComponent(params.get('error_description') ?? params.get('error')!)}`);
} else {
	try {
		await sdk.handleCallback(); // defaults to window.location.href
		window.location.replace('/profile');
	} catch (error) {
		window.location.replace(`/?error=${encodeURIComponent(error instanceof Error ? error.message : 'Login failed')}`);
	}
}
```

### 6. Protect a page

```ts
// src/profile.ts
import { sdk } from './sdk';

if (!(await sdk.checkAuthentication())) {
	await sdk.login(); // or window.location.replace('/login')
} else {
	document.querySelector('#claims')!.textContent = JSON.stringify(sdk.idTokenClaims, null, 2);
}
```

### Other modes in vanilla code (summary)

- `popup`: `initFlow<PopupFlow>({ mode: 'popup', ... })`. `login()` / `register()` resolve once the popup finishes. Call them from a click handler, otherwise the browser blocks the popup. They reject with `PopupBlockedError` or `PopupClosedError` (from `@strivacity/sdk-core/utils`). Keep the callback page. `logout()` does not open a popup: it navigates the current window to the end-session endpoint.
- `embedded`: load the web components with ``injectScript('sty-components', `${issuer}/assets/components/bundle.js`)`` (from `@strivacity/sdk-core/utils`), place `<sty-login>`, `<sty-notifications>` and `<sty-language-selector>`, and listen for the `login`, `close` and `error` DOM events on `<sty-login>`. No callback page is needed.
- `native`: you render the forms yourself. Drive the flow with `await sdk.startSession({ sessionId? })`, then `sdk.submitForm(formId, body)` until the state has a `finalizeUrl`, then `sdk.finalizeSession(url)`. `login()` / `register()` are deprecated in native mode.
- Externally started flows (password reset links and similar) in embedded/native: call `const { session_id, short_app_id, language } = await sdk.entry()` on the entry page and forward them to your login page.

## Quick start (server, BFF)

The Server SDK keeps tokens in encrypted http-only cookies. `createBaseServerSDK(adapter, options)` takes a `ServerAdapter` whose `toRequest(event)` turns your framework's request object into a Fetch API `Request`. Every handler returns a Fetch API `Response`. Pass the **same event object** to every call during one request: the SDK collects `Set-Cookie` headers per event.

### Fetch-style runtimes (Hono, Bun, Deno, Workers)

```ts
// server/auth.ts
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { flushSetCookies } from '@strivacity/sdk-core/utils';

export const auth = createBaseServerSDK<Request>(
	{ toRequest: (request) => request }, // the event already is a Fetch API Request
	{
		mode: 'redirect', // must match the browser SDK
		issuer: process.env.STRIVACITY_ISSUER!, // https://<your-cluster-domain>
		clientId: process.env.STRIVACITY_CLIENT_ID!, // <your-client-id>
		redirectUri: process.env.STRIVACITY_REDIRECT_URI!, // same value as the browser SDK
		scopes: ['openid', 'profile', 'email'],
		cookieSecret: process.env.STRIVACITY_COOKIE_SECRET!, // server-only, e.g. `openssl rand -base64 32`
		postLoginRedirectUri: '/profile',
	},
);

export async function handleRequest(request: Request): Promise<Response> {
	// GET /auth/{login,register,callback,refresh,revoke,entry,logout}, POST /auth/backchannel-logout
	const response = await auth.handler(request);

	if (response) {
		return response;
	}

	if (new URL(request.url).pathname === '/auth/session') {
		const session = await auth.getSession(request); // refreshes near expiry: flush the rotated cookie onto the response
		return flushSetCookies(request, Response.json({ claims: session?.claims ?? null }, { headers: { 'cache-control': 'no-store' } })); // never return raw tokens
	}

	return new Response('Not found', { status: 404 });
}
```

With Hono: `app.all('/auth/*', async (c) => (await auth.handler(c.req.raw)) ?? c.notFound())`.

### Express (and other Node `req` / `res` frameworks)

Bridge Node requests to Fetch API objects. Copy every `set-cookie` header back. Mount the router before any body parser, because back-channel logout reads the raw body.

```ts
// server/index.ts
import express, { Router, type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import { Readable } from 'node:stream';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { flushSetCookies } from '@strivacity/sdk-core/utils';

function toWebRequest(req: ExpressRequest): Request {
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) headers.append(key, v);
	}
	const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
	return new Request(new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`), {
		method: req.method,
		headers,
		...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
	} as RequestInit);
}

async function send(response: Response, res: ExpressResponse): Promise<void> {
	res.status(response.status);
	response.headers.forEach((value, key) => key !== 'set-cookie' && res.setHeader(key, value));
	if (response.headers.getSetCookie().length) res.setHeader('set-cookie', response.headers.getSetCookie());
	res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
}

const auth = createBaseServerSDK<ExpressRequest>(
	{ toRequest: (req) => toWebRequest(req) },
	{
		mode: 'redirect',
		issuer: process.env.STRIVACITY_ISSUER!,
		clientId: process.env.STRIVACITY_CLIENT_ID!,
		redirectUri: process.env.STRIVACITY_REDIRECT_URI!,
		cookieSecret: process.env.STRIVACITY_COOKIE_SECRET!,
	},
);

const router = Router();
router.get('/session', async (req, res) => {
	const session = await auth.getSession(req); // refreshes near expiry: copy the rotated cookie
	const cookies = flushSetCookies(req, new Response(null)).headers.getSetCookie();
	if (cookies.length) res.append('set-cookie', cookies);
	res.set('cache-control', 'no-store').json({ claims: session?.claims ?? null });
});
router.use(async (req, res, next) => {
	try {
		const response = await auth.handler(req); // matches on req.originalUrl, so keep the '/auth' prefix
		return response ? send(response, res) : next();
	} catch (error) {
		next(error);
	}
});

const app = express();
app.set('trust proxy', 1); // behind a TLS-terminating proxy
app.use('/auth', router);
app.listen(3000);
```

For Fastify or Koa, build the `Request` from the raw Node request the same way and copy the `Response` (status, headers, every `set-cookie`, body) back.

### Browser side of a BFF

Add `serverSessionUri: '/auth/login'` to the browser `initFlow` options. `login()` / `register()` then navigate to that endpoint, and the browser SDK never reads or writes tokens, so `isAuthenticated` and `accessToken` stay empty. The callback page forwards the query instead of calling `handleCallback()`: `window.location.href = '/auth/callback' + window.location.search`. Log out by navigating to `/auth/logout` (or `/auth/revoke`). `/auth/logout?returnTo=/path` comes back to a same-origin path (register it as a post-logout redirect URI) instead of `postLogoutRedirectUri`. The browser SDK never refreshes in this mode either (`autoRefresh` is ignored); the server refreshes through `/auth/refresh`. `refresh()` does a full-page navigation (also in popup mode) to `` `${authUrlPrefix}/refresh?returnTo=<current URL>` `` (or `refresh({ returnTo: '/path' })`), and the route rotates the cookie and redirects back. `authUrlPrefix` is a client option too (default `'/auth'`): set it only when the Server SDK uses a different prefix. Read the UI state from your own `/auth/session` endpoint. Serve `/auth/*` from the app's origin (a reverse proxy, or a dev-server proxy).

## Common mistakes

| Mistake                                                            | Fix                                                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `npm install @strivacity/sdk-core` installed v3                    | Install `@strivacity/sdk-core@next` or an exact 4.x version                                                                 |
| `'sdk' is of type 'unknown'` after `initFlow({...})`               | Pass the flow type: `initFlow<RedirectFlow>({...})`                                                                         |
| `sdk.accessToken` / `sdk.idTokenClaims` are `null` on page load    | Synchronous getters read memory. `await sdk.checkAuthentication()` (or `sdk.init()`) first, then read them                  |
| `UnsupportedFlowError: Unsupported flow mode`                      | `mode` is required (`'redirect'`, `'popup'`, `'embedded'` or `'native'`)                                                    |
| `initFlow()` called in several modules                             | Export one instance from `sdk.ts`. Separate instances do not share events or in-memory state                                |
| `import { PopupBlockedError } from '@strivacity/sdk-core'` fails   | The root entry only exports `initFlow` and types. Errors and helpers are in `@strivacity/sdk-core/utils`                    |
| Passing a class as `storage` (`storage: MyStorage`)                | Pass an object: `storage: createSessionStorage()` or `{ get, set, delete }`                                                 |
| `redirect_uri` mismatch                                            | `redirectUri` must exactly match the Admin Console entry (scheme, host, port, path, trailing slash)                         |
| Popup blocked (`PopupBlockedError`)                                | Call popup `login()` / `register()` from a click handler, not on page load                                                  |
| Server: `ConfigurationError: Missing SDK option: cookieSecret`     | Set a server-only `cookieSecret`, or pass a custom `storage`                                                                |
| Server: cookies missing after login                                | Copy **all** `set-cookie` headers back (`response.headers.getSetCookie()`), and pass the same event object to every call    |
| Server: `handler()` always returns `null`                          | It matches on the full pathname `{authUrlPrefix}/...` from `toRequest()`. Keep the prefix in the URL or set `authUrlPrefix` |
| Server: callback fails with "State not found" on several instances | The default `stateStorage` is in-memory per process. Use a shared store (Redis, KV)                                         |

## API quick reference

### `initFlow<Flow>(options)`

Returns the flow object synchronously. Unless `lazyLoad: true`, it also starts `init()` in the background. When `options.factory` is a function, `initFlow` returns `factory(options)` instead of a built-in flow. `mode` is then optional (the factory receives `'redirect'` by default), and the return type is inferred from the factory.

| Option                                       | Default                  | Notes                                                                                                                  |
| -------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `mode`                                       | required                 | `'redirect' \| 'popup' \| 'embedded' \| 'native'`                                                                      |
| `issuer`, `clientId`, `redirectUri`          | required                 | A trailing slash on `issuer` is stripped. Checked inside `init()` (`ConfigurationError`)                               |
| `scopes`                                     | `['openid']`             | Must be an array                                                                                                       |
| `responseType` / `responseMode`              | `'code'` / `'query'`     | `responseMode` can also be `'fragment'`                                                                                |
| `storage`                                    | `createLocalStorage()`   | Session tokens, stored under `storageTokenName`                                                                        |
| `stateStorage`                               | `createSessionStorage()` | PKCE `state` / `nonce` / verifier between login and callback                                                           |
| `storageTokenName`                           | `'sty.session'`          |                                                                                                                        |
| `autoRefresh` / `refreshSkew`                | `true` / `60`            | `checkAuthentication()` refreshes when the token expires within `refreshSkew` seconds. Ignored with `serverSessionUri` |
| `lazyLoad`                                   | `false`                  | `true` skips the automatic `init()`. The first async call (`checkAuthentication()`, ...) runs it                       |
| `serverSessionUri`                           | `null`                   | String: BFF login URL, tokens stay server-side. `true`: server-managed without BFF routing                             |
| `authUrlPrefix`                              | `'/auth'`                | Server SDK route prefix. Server-managed `refresh()` navigates to `${authUrlPrefix}/refresh`. Match the server's prefix |
| `discoveryDocumentCacheTTL` / `jwksCacheTTL` | `3600` / `600`           | Seconds                                                                                                                |
| `logging`                                    | none                     | `createDefaultLogging()` from `@strivacity/sdk-core/utils`, or `{ debug, info, warn, error }`                          |
| `httpClient`                                 | `createHttpClient()`     | Custom: `{ request(url, init), sendTokenRequest(url, data) }`                                                          |
| `urlHandler`, `callbackHandler`              | per mode                 | Custom navigation (for example a Capacitor in-app browser). `urlHandler(url: string \| URL, params?)`                  |
| `factory`                                    | none                     | `(options) => unknown`. Custom flow, see Patterns                                                                      |

Note: `initFlow` copies the options before filling in defaults, so the object you pass in is not modified. Read the resolved values (defaults included) from `sdk.options`.

### Flow instance

| Member                                                                                                           | Notes                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init()`                                                                                                         | Loads the session from `storage`. Idempotent, and concurrent calls share one promise                                                                                                                                                |
| `login(params?)` / `register(params?)`                                                                           | redirect: navigates away. popup: resolves after the token exchange. `register` adds `prompt: 'create'`                                                                                                                              |
| `handleCallback(url?)`                                                                                           | Code exchange on the `redirectUri` page. Throws on `state` mismatch or IdP errors                                                                                                                                                   |
| `checkAuthentication({ autoRefresh }?)`                                                                          | `Promise<boolean>`. Awaits `init()`, refreshes if needed and allowed (never with `serverSessionUri` set)                                                                                                                            |
| `refresh({ returnTo }?)`                                                                                         | Forces a refresh. No-op without a refresh token. Session cleared on failure unless it is `NetworkError` / `ServerError`. Server-managed: navigates to `${authUrlPrefix}/refresh?returnTo=` (`returnTo` defaults to the current URL) |
| `revoke()`                                                                                                       | Clears the local session and revokes the refresh token (or the access token). No IdP logout page                                                                                                                                    |
| `logout({ postLogoutRedirectUri }?)`                                                                             | Clears the local session, then navigates to the end-session endpoint with `id_token_hint` (popup mode: in the same window)                                                                                                          |
| `entry(url?)`                                                                                                    | redirect/popup: forwards to `{issuer}/provider/entry`. embedded/native: resolves `{ session_id, short_app_id, language }`                                                                                                           |
| `subscribeToEvent(name, cb)` / `subscribeToAllEvents(cb)`                                                        | Returns `{ dispose() }`                                                                                                                                                                                                             |
| `updateSession(data)` / `cleanupSession()`                                                                       | Low-level session writes. They dispatch `sessionUpdated` / `sessionCleared`                                                                                                                                                         |
| `tokenExchange(params?)`                                                                                         | Low-level code exchange used by `handleCallback()`                                                                                                                                                                                  |
| `isAuthenticated` / `isAuthenticatedSync`                                                                        | `Promise<boolean>` (same as `checkAuthentication()`) / `boolean` from memory                                                                                                                                                        |
| `accessToken`, `refreshToken`, `idToken`, `idTokenClaims`                                                        | Read from memory, `null` when absent                                                                                                                                                                                                |
| `accessTokenExpired`, `accessTokenExpirationDate`                                                                | `boolean`, Unix seconds or `null`                                                                                                                                                                                                   |
| `session`, `options`, `initialized`, `language`, `sessionId`, `shortAppId`                                       | `session` is settable (for example from a BFF session endpoint)                                                                                                                                                                     |
| embedded/native only: `startSession(params?)`, `finalizeSession(url)`; native only: `submitForm(formId?, body?)` | Journey Flow API steps                                                                                                                                                                                                              |

`login()` params: `prompt`, `display`, `loginHint`, `acrValues`, `uiLocales` and `audiences` (arrays are `string[]`). Redirect adds `locationMethod: 'assign' | 'replace'` and `targetWindow: 'self' | 'top'`. Popup adds `popupWindowFeatures`, `popupWindowTarget` and `checkOrigin`.

### Events

`init`, `sessionLoaded`, `loginInitiated`, `flowInitiated`, `loggedIn`, `sessionUpdated`, `sessionCleared`, `tokenRefreshed`, `tokenRefreshFailed`, `accessTokenExpired`, `tokenRevoked`, `tokenRevokeFailed`, `logoutInitiated`. Token events receive `{ idToken?, accessToken?, refreshToken?, claims? }`. `accessTokenExpired` fires once, when `init()` loads a stored session whose access token has already expired. Subscriptions are per instance.

### Storages (`@strivacity/sdk-core/storages`)

Browser: `createLocalStorage()`, `createSessionStorage()`, `createMemoryStorage()`, `createIndexedDBStorage(dbName?, storeName?)`, `createCacheAPIStorage(cacheName?)`, `createWorkerStorage(worker)` (pair it with `handleWorkerStorageRequests(storage)` inside the worker). Server: `createEncryptedCookieStorage(secret, adapter, options?)` (Server SDK default), `createSessionIdCookieStorage(adapter, store, options?)`, `createServerStateStorage()` (default server `stateStorage`, in-memory), `createServerMemoryStorage()` (dev only). Any `{ get(key), set(key, value), delete(key) }` object returning promises is a valid `SDKStorage`.

### Subpath exports

| Import from                       | Contains                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@strivacity/sdk-core`            | `initFlow` and every type (`RedirectFlow`, `PopupFlow`, `EmbeddedFlow`, `NativeFlow`, `SDKInitConfig`, ...)                                                                                                                                                                                                                                                                      |
| `@strivacity/sdk-core/types`      | Types only                                                                                                                                                                                                                                                                                                                                                                       |
| `@strivacity/sdk-core/flows`      | `createRedirectFlow`, `createPopupFlow`, `createEmbeddedFlow`, `createNativeFlow`, `createBaseFlow`                                                                                                                                                                                                                                                                              |
| `@strivacity/sdk-core/handlers`   | `redirectUrlHandler`, `redirectCallbackHandler`, `popupUrlHandler`, `popupCallbackHandler`                                                                                                                                                                                                                                                                                       |
| `@strivacity/sdk-core/storages`   | Storage factories (above)                                                                                                                                                                                                                                                                                                                                                        |
| `@strivacity/sdk-core/utils`      | Errors (`PopupBlockedError`, `PopupClosedError`, `FallbackError`, `OidcError`, `NetworkError`, `ServerError`, `ConfigurationError`, ...), `createDefaultLogging`, `createHttpClient`, `injectScript`, `getSDKOptions`, `getDefaultFlowState`, `createWebAuthnCredential`, `assertWebAuthnCredential`, `isSessionExpired`, `toClientSession`, `flushSetCookies`, JWT/PKCE helpers |
| `@strivacity/sdk-core/server`     | `createBaseServerSDK`                                                                                                                                                                                                                                                                                                                                                            |
| `.../flows/*`, `.../utils/*`, ... | Single files, for example `@strivacity/sdk-core/flows/base` or `@strivacity/sdk-core/utils/errors`                                                                                                                                                                                                                                                                               |

### Server SDK (`createBaseServerSDK<TEvent>(adapter, options)`)

`adapter`: `{ toRequest(event), redirect?(url, status, event), getSessionId?(key, event) }`. Options: every client option plus `cookieSecret`, `authUrlPrefix` (`'/auth'`), `loginUri` (`'/login'`), `postLoginRedirectUri` and `postLogoutRedirectUri` (both default to the origin of `redirectUri`), `cookieMaxAge` (`2592000`), and `serverSessionUri` (`` `${authUrlPrefix}/login` ``). Methods: `handler(event)` (returns `null` for unknown paths), `handleLogin`, `handleRegister`, `handleCallback`, `handleRefresh`, `handleRevoke`, `handleEntry`, `handleLogout`, `handleBackChannelLogout`, `getSession(event?, { autoRefresh }?)` (refreshes an expired or near-expiry session first, see below), `updateSession`, `refreshSession` (throws on failure), `revokeSession`, `completeLogin`, `logout`, `getEntrySession`. Failures redirect to `{origin}/error?type=&error=&error_description=`, so the app needs an `/error` page.

`getSession(event)` refreshes when `autoRefresh` is on (option or per-call param, default `true`), the access token is within `refreshSkew` of expiry and a refresh token exists, at most once per request event (concurrent and later calls with the same event object share the result). A failed refresh resolves to `null`. With `autoRefresh: false` it returns the stored session as is (no expiry check). Like `updateSession` / `refreshSession`, it only queues the rotated `Set-Cookie` headers on the event, so copy them to your response with `flushSetCookies(event, response)` from `@strivacity/sdk-core/utils` (the built-in route handlers do this for you).

`toClientSession(session)` (`@strivacity/sdk-core/utils`) returns a copy without `refresh_token` and `id_token` (or `null`). Use it whenever a server-side session goes to the browser (page data, a session endpoint).

## Patterns

### Call an API with the access token

```ts
import { sdk } from './sdk';

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
	if (!(await sdk.checkAuthentication())) {
		throw new Error('Not authenticated');
	}

	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${sdk.accessToken}`);

	return fetch(input, { ...init, headers });
}
```

Request the API's audience at login (`audiences: ['https://api.example.com']`) if the API validates `aud`. There is no background refresh timer: tokens are refreshed when `checkAuthentication()` runs.

### Storage and logging choices

```ts
import { initFlow } from '@strivacity/sdk-core';
import type { RedirectFlow } from '@strivacity/sdk-core';
import { createSessionStorage } from '@strivacity/sdk-core/storages';
import { createDefaultLogging } from '@strivacity/sdk-core/utils';

export const sdk = initFlow<RedirectFlow>({
	mode: 'redirect',
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'http://localhost:5173/callback',
	storage: createSessionStorage(), // tokens die with the tab
	logging: createDefaultLogging(), // console logging, development only
	lazyLoad: true, // nothing is read from storage until init() or the first auth check (checkAuthentication(), login(), ...)
});
```

### Custom flow with `factory`

Compose `createBaseFlow` instead of subclassing. The factory receives the raw options, so call `getSDKOptions` to get a copy with the defaults applied. Call `init()` yourself, because only the built-in flows start it automatically.

```ts
// src/custom-flow.ts
import { initFlow } from '@strivacity/sdk-core';
import type { SDKInitConfig } from '@strivacity/sdk-core';
import { createBaseFlow } from '@strivacity/sdk-core/flows';
import { getDefaultFlowState, getSDKOptions } from '@strivacity/sdk-core/utils';

export function createCustomFlow(initConfig: SDKInitConfig) {
	const state = getDefaultFlowState();
	const options = getSDKOptions(initConfig);
	const base = createBaseFlow(state, options);

	async function login(): Promise<void> {
		await base.init();
		window.location.assign('/my-backend/login');
	}

	void base.init();

	return {
		...base,
		login,
		get idTokenClaims() {
			return state.session?.claims ?? null;
		},
	};
}

export type CustomFlow = ReturnType<typeof createCustomFlow>;

// `mode` is optional with a factory, and the flow type is inferred from it
export const sdk = initFlow({
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'http://localhost:5173/callback',
	factory: createCustomFlow,
});
```

Prefer `serverSessionUri` plus the Server SDK over a custom flow when the goal is to route login through your backend.

Further reading: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core and https://docs.strivacity.com/reference/overview
