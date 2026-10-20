# Token storage and lifecycle

Where the SDK keeps tokens, how they expire and refresh, and how to end a session. Use this to pick a storage, to keep access tokens fresh before API calls, and to choose between `revoke()` and `logout()`.

## Critical rules

- **Browser apps use a public PKCE client.** No client secret in browser code. The Server SDK `cookieSecret` is only the cookie encryption key and stays on the server.
- **Anything a page script can reach, an XSS bug can steal.** That includes `localStorage` (the default), `sessionStorage`, IndexedDB, the Cache API and the SDK instance itself. For high-risk apps (finance, health, admin consoles) keep tokens out of the browser with a BFF (`serverSessionUri`). If you cannot run a server, prefer `createMemoryStorage()` over the default.
- **Never log, print or send tokens anywhere except the API they are for.** No tokens in URLs, analytics, error reports or `console.log`. The built-in logger never prints them.
- **Read `sdk.accessToken` after `await sdk.checkAuthentication()`**, not from a value captured earlier. The SDK has no background refresh timer.
- **Keep `stateStorage` persistent across a page load** (the default `sessionStorage` is right). The PKCE state must survive the trip to the IdP and back.

## What the SDK stores

| Item               | Where                                                  | Key                                                                        | Content                                                                                                                               |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Session            | `storage` (client) or the server session storage (BFF) | `storageTokenName` (default `'sty.session'`). Server: also the cookie name | JSON `SessionData`: `access_token`, `refresh_token`, `id_token`, `expires_in`, `expires_at` (Unix seconds), `scope`, `claims`         |
| PKCE / login state | `stateStorage`                                         | `sty.<state id>`                                                           | Code verifier, nonce, `metadata` (prompt, display, audiences, ...). Deleted when the callback uses it, also for an `?error=` callback |

`expires_at` is computed as local time + `expires_in` when the token arrives, so it does not depend on clock skew between the device and the IdP. `claims` are the decoded ID token claims.

With `serverSessionUri` set, the browser SDK never reads or writes `storage` or `stateStorage`. The Server SDK uses its own `storage` and `stateStorage`.

## Choosing where tokens live

| Situation                                                                    | Choose                                                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| You have (or can add) a server, SSR framework, or a "no tokens in JS" policy | BFF: `serverSessionUri: '/auth/login'` + Server SDK with encrypted cookies               |
| Pure static SPA, higher risk, users accept logging in again after a reload   | `storage: createMemoryStorage()`                                                         |
| Pure static SPA, session per tab                                             | `storage: createSessionStorage()`                                                        |
| Pure static SPA, low risk, session should survive restarts                   | default `createLocalStorage()`                                                           |
| Large sessions, or storage needed inside a Service Worker                    | `createIndexedDBStorage()` / `createCacheAPIStorage()` (same exposure as `localStorage`) |

## Built-in storages

Client factories come from the wrapper package (`@strivacity/sdk-react`, `@strivacity/sdk-vue`, `@strivacity/sdk-angular`, `@strivacity/sdk-preact`, `@strivacity/sdk-next/client`, `@strivacity/sdk-svelte/client`, `@strivacity/sdk-solid/client`) or from `@strivacity/sdk-core/storages`. Every storage implements `SDKStorage`: async `get(key)`, `set(key, value)`, `delete(key)` with string values.

| Factory                                       | Default for           | Survives                                        | Notes                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createLocalStorage()`                        | client `storage`      | Reloads, new tabs, browser restarts             | Shared by all tabs of the origin. Any script on the origin can read it                                                                                                                                                                                                         |
| `createSessionStorage()`                      | client `stateStorage` | Reloads and redirects in the same tab           | Per tab. A new tab starts logged out                                                                                                                                                                                                                                           |
| `createMemoryStorage()`                       | none                  | Nothing: lost on reload                         | No storage key to scrape. Works with `redirect` mode because the code exchange runs after the callback page loads, as long as the app then navigates client-side (no full reload). Do not use it for `stateStorage` in `redirect` mode                                         |
| `createIndexedDBStorage(dbName?, storeName?)` | none                  | Restarts                                        | Defaults `'sdk-storage'` / `'kv'`. Works in workers. Readable by any same-origin script                                                                                                                                                                                        |
| `createCacheAPIStorage(cacheName?)`           | none                  | Restarts                                        | Default cache name `'strivacity-sdk'`. Works in Service Workers. Readable by any same-origin script                                                                                                                                                                            |
| `createWorkerStorage(worker)`                 | none                  | Whatever the storage inside the worker survives | Inside the worker call `handleWorkerStorageRequests(storage)`. Only the persisted copy moves: the SDK still loads the session into main-thread memory (`sdk.session`, `sdk.accessToken`). With IndexedDB or Cache API behind it, same-origin scripts can still open that store |

Server factories come from `@strivacity/sdk-core/storages`, or from the framework's `/server` entry (Next.js and Nuxt ship variants without the `adapter` argument):

| Factory                                                   | Default for               | Notes                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createEncryptedCookieStorage(secret, adapter, options?)` | Server SDK `storage`      | AES-256-GCM (HKDF-SHA-256 key from `cookieSecret`). Cookie `HttpOnly; Secure; SameSite=Lax; Path=/`, `Max-Age` = `cookieMaxAge` (default 30 days), split into `name.0`, `name.1`, ... above 3900 chars. No back-channel logout |
| `createSessionIdCookieStorage(adapter, store, options?)`  | none                      | Random session-id cookie (`crypto.randomUUID()`), payload in your `store` (Redis, database). Supports back-channel logout when `store.deleteByLogoutToken` exists                                                              |
| `createServerMemoryStorage()`                             | none                      | Development only. Process memory, implements `deleteByLogoutToken`. Shares (and resets) the global map that `createServerStateStorage()` uses                                                                                  |
| `createServerStateStorage()`                              | Server SDK `stateStorage` | In-memory `Map` in one process, with no expiry. Replace it with a shared store with a TTL when more than one instance runs                                                                                                     |

Next.js: `createEncryptedCookieStorage(secret, options?)` and `createSessionIdCookieStorage(store, options?)` from `@strivacity/sdk-next/server`. Nuxt: point `storageFactoryPath` / `stateStorageFactoryPath` in `nuxt.config.ts` at a module that default-exports a factory. These apply to the Nuxt Server SDK. The Nuxt client SDK always uses the default client storages.

### Configuring the client storage

```tsx
// React (same option name in every wrapper: StyAuthProvider options, createStrivacitySDK, provideStrivacity, createStyAuthProvider)
import type { ReactNode } from 'react';
import { StyAuthProvider, createMemoryStorage, createSessionStorage, type SDKInitConfig } from '@strivacity/sdk-react';

const options: SDKInitConfig = {
	mode: 'redirect',
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'https://app.example.com/callback',
	scopes: ['openid', 'profile', 'offline_access'], // a refresh token is only issued if the client and scopes allow it
	storage: createMemoryStorage(), // tokens only in memory
	stateStorage: createSessionStorage(), // the default, shown for clarity: must survive the redirect
	storageTokenName: 'sty.session.orders', // unique per app when several apps share an origin
};

export function AuthProvider({ children }: { children: ReactNode }) {
	return <StyAuthProvider options={options}>{children}</StyAuthProvider>;
}
```

Worker-backed storage:

```ts
// src/auth/storage.worker.ts
import { createIndexedDBStorage, handleWorkerStorageRequests } from '@strivacity/sdk-core/storages';

handleWorkerStorageRequests(createIndexedDBStorage());
```

```ts
// src/auth/options.ts
import { createWorkerStorage } from '@strivacity/sdk-react';

export const storage = createWorkerStorage(new Worker(new URL('./storage.worker.ts', import.meta.url), { type: 'module' }));
```

### `storageTokenName`

- Default `'sty.session'`. It is the client storage key and, on the server, the cookie name.
- Give each app its own name when several apps share an origin (they would otherwise overwrite each other's session).
- Renaming it signs everyone out. The old entry stays in `localStorage` until you delete it.

## Expiry and refresh

| Getter / method                                       | Meaning                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessTokenExpirationDate`                           | `expires_at` in **Unix seconds** (`new Date(value * 1000)`), or `null`                                                                                                                                                                   |
| `accessTokenExpired`                                  | `true` when there is no session, no access token, or `expires_at <= now`. No skew                                                                                                                                                        |
| `isAuthenticatedSync`                                 | Session in memory and not expired. Never refreshes                                                                                                                                                                                       |
| `await sdk.isAuthenticated` / `checkAuthentication()` | Awaits `init()` first. Valid and more than `refreshSkew` seconds left → `true`. Otherwise, if `autoRefresh`, a refresh token and no `serverSessionUri`, calls `refresh()` (a failed refresh is not rethrown). Then returns "not expired" |
| `checkAuthentication({ autoRefresh: false })`         | Same check without refreshing                                                                                                                                                                                                            |
| `refresh({ returnTo }?)`                              | Refresh-token grant now. Concurrent calls share one request. Does nothing without a refresh token. Server-managed: navigates to `` `${authUrlPrefix}/refresh` `` (see below)                                                             |

Options: `autoRefresh` (default `true`) and `refreshSkew` (default `60` seconds, capped at half of the token lifetime `expires_in`). A refresh keeps the current refresh token when the authorization server does not issue a new one, and keeps the ID token and claims when the response has none. **`autoRefresh` does not start a timer**, and it is ignored when `serverSessionUri` is set: then the server owns the refresh token and refreshes through its `/auth/refresh` route or the framework's server helpers. Refresh happens only when something calls `checkAuthentication()`: your code, `sdk.isAuthenticated`, the wrappers' state updates after each SDK event, and the route guards (`withAuthGuard`). A tab that sits idle keeps an expired token until then. Tabs sharing the session storage refresh one at a time (Web Locks API, per client and storage key): a tab that waited re-reads the storage and uses the session the other tab just stored instead of sending the old refresh token again (which fails with refresh token rotation and clears the session).

### Server-managed sessions: `authUrlPrefix`

With `serverSessionUri` set, `refresh()` navigates the browser (full page, also in popup mode) to `` `${authUrlPrefix}/refresh?returnTo=<returnTo>` ``. `authUrlPrefix` is a client option (default `'/auth'`): change it only to match a Server SDK that uses a different prefix. `returnTo` is `refresh({ returnTo })` or the current path, query and hash. The Server SDK route rotates the cookie and redirects back (it rejects a cross-origin `returnTo`, and redirects to `/error` when the refresh fails). Nothing is refreshed in the browser itself.

- React, Preact and Solid `withAuthGuard`: with `serverSessionUri` set, a hydrated session that is no longer authenticated (expired) goes through `sdk.refresh()` instead of the login redirect.
- Your own client route guards (Angular `CanActivateFn`, Nuxt / Vue route middleware): for an expired session call `await sdk.refresh({ returnTo: <target path> })` and cancel the navigation. During SSR the server already refreshed.
- Server code: `getSession(event)` refreshes a near-expiry session once per request (unless `autoRefresh` is `false`), see the server-session reference. Next.js refreshes there only in route handlers given the App Router `Request`.

Wrapper state (`useStrivacity().accessToken`, the Angular signals) mirrors the SDK after each event. For an API call use the flow instance: `await sdk.checkAuthentication()`, then `sdk.accessToken`.

### Refresh before expiry (optional)

Safe to run in every tab: the timers of several tabs fire together, but the SDK serializes the refreshes and the other tabs pick up the new session.

```ts
// src/auth/keep-fresh.ts - call once after the provider is ready; returns a cleanup function
import type { SDK } from '@strivacity/sdk-react'; // `useStrivacity().sdk`, or `inject(StrivacityAuthService).sdk` in Angular

type FreshnessSource = Pick<SDK, 'session' | 'accessTokenExpirationDate' | 'refreshToken' | 'options' | 'checkAuthentication' | 'subscribeToEvent'>;

export function keepTokenFresh(sdk: FreshnessSource): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const schedule = () => {
		clearTimeout(timer);
		const expiresAt = sdk.accessTokenExpirationDate;

		if (!expiresAt || !sdk.refreshToken) return;

		// Same skew as the SDK (capped at half of the token lifetime), otherwise the timer fires before checkAuthentication() refreshes
		const lifetime = sdk.session?.expires_in;
		const skew = lifetime ? Math.min(sdk.options.refreshSkew, Math.floor(lifetime / 2)) : sdk.options.refreshSkew;
		const delayMs = Math.max(0, (expiresAt - skew) * 1000 - Date.now());
		timer = setTimeout(() => void sdk.checkAuthentication(), delayMs);
	};

	const subscriptions = [
		sdk.subscribeToEvent('sessionLoaded', schedule),
		sdk.subscribeToEvent('loggedIn', schedule),
		sdk.subscribeToEvent('tokenRefreshed', schedule),
		sdk.subscribeToEvent('sessionCleared', () => clearTimeout(timer)),
	];

	schedule();

	return () => {
		clearTimeout(timer);
		subscriptions.forEach((subscription) => subscription.dispose());
	};
}
```

### Refresh failures

- `OidcError` (for example `invalid_grant`), `ProtocolError` and other non-transient errors: the client SDK **clears the session** (`sessionCleared`), emits `tokenRefreshFailed` with `{ refreshToken }`, and `refresh()` rethrows. Send the user to login.
- `NetworkError` / `ServerError` (`429`, `5xx`): the session is **kept**, `tokenRefreshFailed` still fires. Retry later.
- Server SDK `refreshSession()` / `GET /auth/refresh`: clears the cookie on every refresh-request error, including network errors.
- Tabs do not sync. Each tab loads the stored session once at startup. If the IdP rotates refresh tokens, two tabs that refresh the same `localStorage` session can invalidate each other, and the failing tab then deletes the shared entry.

```ts
// Send the user to login when the session cannot be refreshed
import type { SDK } from '@strivacity/sdk-react';

export function onSessionLost(sdk: Pick<SDK, 'session' | 'subscribeToEvent'>, goToLogin: () => void): () => void {
	const subscription = sdk.subscribeToEvent('tokenRefreshFailed', () => {
		if (!sdk.session) goToLogin(); // cleared = not a transient error
	});

	return () => subscription.dispose();
}
```

### Events

`subscribeToEvent(name, callback)` returns `{ dispose() }`. `subscribeToAllEvents(callback)` exists too. Event names (from `EventFunctions`):

| Event                | Payload                                          | Fires when                                                                         |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `init`               | none                                             | `init()` finished                                                                  |
| `sessionLoaded`      | `{ idToken, accessToken, refreshToken, claims }` | `init()` found a stored session                                                    |
| `accessTokenExpired` | `{ accessToken, refreshToken }`                  | `init()` found a stored session whose access token is already expired (fired once) |
| `loginInitiated`     | none                                             | `login()` / `register()` started (redirect, popup)                                 |
| `flowInitiated`      | none                                             | Embedded / native `startSession()` started                                         |
| `loggedIn`           | `{ idToken, accessToken, refreshToken, claims }` | Code exchange succeeded                                                            |
| `sessionUpdated`     | `{ idToken, accessToken, refreshToken, claims }` | Session written (login, refresh, `updateSession()`)                                |
| `tokenRefreshed`     | `{ idToken, accessToken, refreshToken, claims }` | Refresh succeeded                                                                  |
| `tokenRefreshFailed` | `{ refreshToken }`                               | Refresh failed (see above)                                                         |
| `sessionCleared`     | none                                             | Session removed (logout, revoke, failed refresh, `cleanupSession()`)               |
| `logoutInitiated`    | `{ idToken, claims }`                            | `logout()` cleared the session, before the end-session redirect                    |
| `tokenRevoked`       | `{ token, tokenTypeHint }`                       | Revocation request succeeded                                                       |
| `tokenRevokeFailed`  | `{ token, tokenTypeHint }`                       | Revocation request failed                                                          |

Payloads contain tokens. Never forward them to analytics or logs.

## Ending the session: `revoke()` vs `logout()`

| Call                                | Local session  | Tokens at the IdP                                                                                                | IdP login session (SSO) | Navigation                                                                                       |
| ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `revoke()`                          | cleared first  | Revokes the refresh token, or the access token if there is none. Skipped if the IdP has no `revocation_endpoint` | stays                   | none                                                                                             |
| `logout({ postLogoutRedirectUri })` | cleared first  | not revoked                                                                                                      | ended                   | Redirects to the end-session endpoint with `id_token_hint`, then back to `postLogoutRedirectUri` |
| BFF `GET /auth/revoke`              | cookie cleared | Revokes as above                                                                                                 | stays                   | 302 to the Server SDK `postLogoutRedirectUri`                                                    |
| BFF `GET /auth/logout`              | cookie cleared | not revoked                                                                                                      | ended                   | 302 to the end-session endpoint, then a same-origin `?returnTo=` or `postLogoutRedirectUri`      |

- Register every `postLogoutRedirectUri` on the client in the Admin Console. Without it, the user stays on the Strivacity logged-out page.
- `logout()` needs an ID token (keep `openid` in `scopes`). Without one it only clears the local session.
- You cannot call `revoke()` and then `logout()`: `revoke()` clears the ID token that `logout()` needs. To do both, revoke the refresh token directly first:

```ts
import { revokeToken, type SDK } from '@strivacity/sdk-react';

export async function signOutEverywhere(sdk: Pick<SDK, 'refreshToken' | 'options' | 'logout'>, postLogoutRedirectUri: string): Promise<void> {
	const refreshToken = sdk.refreshToken;

	if (refreshToken) {
		try {
			await revokeToken({ tokenTypeHint: 'refresh_token', token: refreshToken, options: sdk.options });
		} catch {
			// continue with logout: the end-session redirect matters more than the revocation result
		}
	}

	await sdk.logout({ postLogoutRedirectUri });
}
```

## When the BFF is the better choice

- Tokens must not be readable by browser JavaScript, or an SSR framework needs the session on the server.
- The access token is used by your own server anyway (the BFF calls the API, or proxies to it).

**SSR caveat:** the framework wrappers can hydrate the server session into the client SDK so that `isAuthenticated` works during rendering. Whatever you hydrate is serialized into the page.

- Nuxt (the module's route middleware stores the session in `useSession()` on every server-rendered route when server sessions are on) and Angular `provideStrivacityServerSession()` (TransferState) do this automatically. They refresh a near-expiry session first (`getSession()` with the default `autoRefresh`) and remove `refresh_token` and `id_token` (`toClientSession`), but the access token and the claims are in the page.
- Next.js `<StyAuthProvider session={...}>`, and a SvelteKit or SolidStart `load` / provider `session` that you fill from `getSession()`, contain whatever you pass. The raw `getSession()` result is the full `SessionData`, including the refresh and ID tokens. Pass `toClientSession(session)` (exported by every wrapper package), which drops `refresh_token` and `id_token` (refresh runs through `/auth/refresh` on the server, and only the server `/auth/logout` route needs the ID token).

If no token may reach the browser at all, do not hydrate the session: return claims and expiry from your own loader instead, and accept that the client SDK's `isAuthenticated` stays `false`. Nuxt's built-in server-session mode always puts the access token into the page payload.

## Common mistakes

| Mistake                                                                | Symptom                                                     | Fix                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Default `localStorage` in a high-risk app                              | Tokens exposed to XSS and browser extensions                | BFF, or `createMemoryStorage()`                                                              |
| `stateStorage: createMemoryStorage()` with `redirect` mode             | `ProtocolError: Invalid or missing state` on every callback | Keep the default `createSessionStorage()`                                                    |
| Expecting `autoRefresh` to refresh in the background                   | Expired token sent to the API after idle time               | `await sdk.checkAuthentication()` before each call, or a scheduler as shown above            |
| `accessTokenExpirationDate` treated as milliseconds                    | Token always looks expired / wrong date                     | Multiply by 1000                                                                             |
| Treating every `tokenRefreshFailed` as a logout                        | Users signed out during a network blip                      | Check whether the session was cleared                                                        |
| `revoke()` used as "log out"                                           | Next login skips the login form (IdP session still active)  | `logout({ postLogoutRedirectUri })`                                                          |
| `revoke()` then `logout()`                                             | No redirect to the IdP                                      | Revoke with `revokeToken()` first, as shown above                                            |
| Several apps on one origin with the same `storageTokenName`            | Apps overwrite each other's session                         | One name per app                                                                             |
| Logging `sessionUpdated` / `tokenRefreshed` payloads                   | Tokens in logs                                              | Log event names only                                                                         |
| Raw session hydrated into an SSR page (Next.js, SvelteKit, SolidStart) | Refresh and ID tokens in the HTML payload                   | Pass `toClientSession(session)`, or claims only (see the SSR caveat)                         |
| Server SDK on a non-default `authUrlPrefix`, client left at `'/auth'`  | `refresh()` and the guards land on a 404                    | Set the same `authUrlPrefix` on the client                                                   |
| Client secret added "to make refresh work"                             | Secret shipped to every browser                             | Public PKCE client. Request `offline_access` (or what the client allows) for a refresh token |

More detail: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core (Storages, Session state, SDK events) and https://docs.strivacity.com/reference/overview
