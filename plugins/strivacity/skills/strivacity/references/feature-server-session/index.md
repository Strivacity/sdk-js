# Server-managed sessions (BFF)

Keep Strivacity tokens on the server. A backend-for-frontend (BFF) runs the OIDC code exchange with the Strivacity Server SDK and stores the session in encrypted, http-only cookies. The browser only sees what your app chooses to expose, usually ID token claims.

## Critical rules

- **The cookie secret is server-only.** Never prefix it with `VITE_`, `NEXT_PUBLIC_` or `PUBLIC_`, never commit it, and ask before writing it to any `.env` file. Never read existing `.env*` files without permission.
- **Same client, same mode, same `redirectUri` on both sides.** The browser SDK and the Server SDK must use the same `clientId`, `mode` and `redirectUri`.
- **In BFF mode the browser never calls `handleCallback()`, `logout()` or `revoke()` of the client SDK.** It navigates to the server routes instead.
- **Serve the BFF routes from the same origin as the app** (reverse proxy in production, dev-server proxy locally). Cookies, the `returnTo` checks and the error redirects all assume the app origin.
- v4 packages are published under the npm `next` dist-tag (`4.0.0-beta.x`). Install with `@next` and pin the exact version.

## When to choose it

- Tokens must never be readable by browser JavaScript (XSS hardening, compliance, "no tokens in localStorage" policies).
- Any SSR framework (Next.js, Nuxt, SvelteKit, SolidStart, Angular SSR): server code needs the session to render pages.
- A higher-security default for new apps that already have a server.

Stay with client-managed sessions (default, `serverSessionUri: null`) for a pure static SPA with no server you control.

## How it works

1. The client SDK option `serverSessionUri` (`boolean | string | null`, client default `null`) switches the browser SDK into server-managed mode:
   - `null` / `false` / unset: client-managed. Tokens live in browser storage.
   - a string, such as `'/auth/login'`: `login()` / `register()` navigate to that BFF endpoint. Only the non-sensitive extras (`prompt`, `display`, `login_hint`, `acr_values`, `ui_locales`, `audience`, `resource`) are added as query params. The browser SDK never reads or writes tokens, and never refreshes: `checkAuthentication()` / `isAuthenticated` ignore `autoRefresh` whenever `serverSessionUri` is set. Refresh through `{authUrlPrefix}/refresh` or the Server SDK: `refresh()` navigates the browser (full page, also in popup mode) to `` `${authUrlPrefix}/refresh?returnTo=<current URL>` `` (or `refresh({ returnTo: '/path' })`), the route rotates the cookie and redirects back. `authUrlPrefix` is a client option too (default `'/auth'`); set it only when the Server SDK uses a different prefix. The React, Preact and Solid `withAuthGuard` call `refresh()` by themselves when a hydrated session is no longer authenticated.
   - `true`: server-managed, but the browser SDK builds the IdP authorize URL itself (advanced, rarely needed).
   - The Server SDK defaults `serverSessionUri` to `` `${authUrlPrefix}/login` `` (`/auth/login`).
2. The Server SDK builds the authorize request (PKCE, `state`, `nonce`), keeps the PKCE state server-side, and proxies the IdP redirect to the browser.
3. The IdP redirects to `redirectUri`. The request reaches `GET {authUrlPrefix}/callback`, which exchanges the code, validates the ID token, writes the encrypted session cookie and redirects back into the app.
4. The app reads the session through a small endpoint you write (or the framework wrapper's loader). Server code calls `getSession(event)`.

### Server SDK routes

`handler(event)` dispatches these. It returns `null` for other paths. Each route also exists as a separate `handleXxx(event)` method.

| Method | Path                                 | Method name               | Behaviour                                                                                                                                                              |
| ------ | ------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `{authUrlPrefix}/login`              | `handleLogin`             | Starts login and proxies the IdP redirect. Accepts `?returnTo=<same-origin path>` plus the extras listed above                                                         |
| GET    | `{authUrlPrefix}/register`           | `handleRegister`          | Same as login with `prompt=create`                                                                                                                                     |
| GET    | `{authUrlPrefix}/callback`           | `handleCallback`          | Code exchange, sets the session cookie, 302 to `returnTo` or `postLoginRedirectUri`. In popup mode it returns an HTML page that notifies the opener and closes itself  |
| GET    | `{authUrlPrefix}/refresh`            | `handleRefresh`           | Refreshes tokens. `204` without `returnTo`, 302 to `returnTo` with it                                                                                                  |
| GET    | `{authUrlPrefix}/revoke`             | `handleRevoke`            | Revokes tokens, clears the cookie, 302 to `postLogoutRedirectUri` (no IdP logout page)                                                                                 |
| GET    | `{authUrlPrefix}/entry`              | `handleEntry`             | Externally-initiated flows (embedded/native): 302 to `loginPageUri?session_id=&short_app_id=&language=`                                                                |
| GET    | `{authUrlPrefix}/logout`             | `handleLogout`            | Clears the cookie, 302 to the IdP end-session endpoint, then back to a same-origin `?returnTo=` (register it as a post-logout redirect URI) or `postLogoutRedirectUri` |
| POST   | `{authUrlPrefix}/backchannel-logout` | `handleBackChannelLogout` | OIDC back-channel logout (see below)                                                                                                                                   |

On failure, callback, refresh, revoke, entry and logout redirect to `{request origin}/error?type=...&error=...&error_description=...`. The app needs an `/error` route.

Programmatic API on the same object: `getSession(event?, { autoRefresh? }?)`, `updateSession(session, event)`, `refreshSession(event)`, `revokeSession(event)`, `completeLogin(params, event)`, `logout(postLogoutRedirectUri, event)`, `getEntrySession(url)`, `options`.

`getSession(event)` refreshes the session first when `autoRefresh` is on (the default), the access token is expired or within `refreshSkew` of expiry, and a refresh token exists. It refreshes at most once per request event: concurrent and later calls with the same event share the result. A failed refresh resolves to `null` (and clears the cookie). An expired session without a refresh token is returned as stored, so check `isSessionExpired(session)` (from `@strivacity/sdk-core/utils`) where that matters. The rotated cookie is only queued on the event, so it works only where the response cookies can still be written: the framework integrations write it for you (SvelteKit `handle`, SolidStart `middleware`, the Nuxt SSR middleware, Angular `provideStrivacityServerSession`). In your own Express routes copy it with `flushSetCookies(req, response)` from `@strivacity/sdk-core/utils`. Pass `getSession(event, { autoRefresh: false })` for a plain read where the response cookies cannot be written. Set `autoRefresh: false` in the Server SDK options to turn the server-side refresh off: `getSession` (and every integration above) then returns the stored session as is, and the Next.js `withAuthGuard` sends an expired session to the login page instead of `{authUrlPrefix}/refresh`.

## Server SDK options

All client `SDKOptions` apply (`mode`, `issuer`, `clientId`, `redirectUri`, `scopes`, `storageKey` (default `'sty.session'`, also the cookie name)...). Server-specific options:

| Option                  | Default                                                                                             | Notes                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cookieSecret`          | none                                                                                                | Required when no custom `storage` is given. Otherwise throws `ConfigurationError: Missing SDK option: secret` (Next.js and Nuxt: `Secret is required for encrypted cookie storage`) |
| `authUrlPrefix`         | `'/auth'`                                                                                           | Prefix that `handler()` matches                                                                                                                                                     |
| `loginPageUri`          | `'/login'`                                                                                          | The app's login page, used by `/entry` (embedded/native)                                                                                                                            |
| `postLoginRedirectUri`  | origin of `redirectUri`                                                                             | Used when no `returnTo` was given. Relative paths resolve against the request origin                                                                                                |
| `postLogoutRedirectUri` | origin of `redirectUri`                                                                             | After `/logout` and `/revoke`. Register it on the client in the Admin Console                                                                                                       |
| `cookieMaxAge`          | `2592000` (30 days)                                                                                 | Max-Age of the default encrypted cookie                                                                                                                                             |
| `serverSessionUri`      | `` `${authUrlPrefix}/login` ``                                                                      |                                                                                                                                                                                     |
| `storage`               | `createEncryptedCookieStorage(secret, adapter, { defaultCookieOptions: { maxAge: cookieMaxAge } })` | `ServerStorage`. Cookies are `HttpOnly; Secure; SameSite=Lax; Path=/`, and values over 3900 chars are split into `name.0`, `name.1`, ...                                            |
| `stateStorage`          | `createServerStateStorage()`                                                                        | PKCE/state store. **In-memory Map, single process only**                                                                                                                            |

## Generating the secret

The default storage derives an AES-256-GCM key from `cookieSecret` with HKDF-SHA-256, a fresh random salt per cookie, and the context `strivacity-session-v1`. Any string works and no length is enforced, so use 32 random bytes:

```bash
openssl rand -base64 32
# or: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Store it in the server's secret manager or a server-only env var (for example `STRIVACITY_COOKIE_SECRET`). Use the same value on every instance. Rotating it logs everyone out: old cookies fail to decrypt and are treated as no session.

## Per-framework entry points

| Stack                     | Create the Server SDK with                                                                                              | Wiring                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Express / any Node server | `createBaseServerSDK(adapter, options)` from `@strivacity/sdk-core/server`                                              | You write the `toRequest` adapter and the Response bridge (worked example below) |
| Next.js                   | `createServerSDK(options)` from `@strivacity/sdk-next/server`                                                           | The returned SDK also has `withAuthGuard` / `withApiAuthRequired`                |
| Nuxt                      | `@strivacity/sdk-nuxt` module, `strivacity: { cookieSecret, serverSessionUri, authUrlPrefix, ... }` in `nuxt.config.ts` | Nitro routes are registered automatically. Server sessions are on by default     |
| Angular SSR (Express)     | `createServerSDK(options)` from `@strivacity/sdk-angular/server`                                                        | `provideStrivacityServerSession(serverSdk)` hands the session to the app         |
| SolidStart                | `createServerSDK(options)` from `@strivacity/sdk-solid/server`                                                          | `middleware` in `src/middleware.ts`                                              |
| SvelteKit                 | `createServerSDK(options)` from `@strivacity/sdk-svelte/server`                                                         | `handle` in `hooks.server.ts`                                                    |

Each framework reference has the detailed setup.

- **Session data in server-rendered pages.** Nuxt (its route middleware fills `useSession()`) and Angular SSR (`provideStrivacityServerSession()` fills `TransferState`) hand the session to the browser automatically. Both remove `refresh_token` and `id_token` first. The access token and the claims are still in the page payload. Next.js (`<StyAuthProvider session={...}>`), SvelteKit and SolidStart pass on only what your code gives them. Pass `toClientSession(session)` (exported by every wrapper, and by `@strivacity/sdk-core/utils`), which returns a copy without `refresh_token` and `id_token` (refresh runs through `/auth/refresh`, and only the server `/auth/logout` route needs the ID token), or pass only claims.
- **Nuxt:** the SDK instance exists only in the browser. During SSR `useStrivacity()` is read-only: its refs, `sdk.options` and `sdk.session` can be read, and flow methods such as `login()` throw. If the Server SDK cannot start (for example `cookieSecret` is missing), Nitro logs `Failed to initialize the Strivacity server SDK` with the cause at startup, and every request that uses the SDK fails with `500 Strivacity SDK failed to initialize`.
- **SvelteKit and SolidStart:** `getSession(event)` (and SvelteKit `requireSession()`) refresh a near-expiry session at most once per request and give every caller in that request the same rotated session. `handle` / `middleware` add the rotated cookie to the page response (also after your own `refreshSession()` call). A failed refresh returns `null`.
- **Nuxt and Angular SSR:** the module's SSR middleware (Nuxt) and `provideStrivacityServerSession` (Angular) call `getSession()` and write the rotated cookie to the rendered response, so `useSession()` / `TransferState` get the fresh session (empty when the refresh fails). **Next.js:** `withAuthGuard` redirects expired sessions to `{authUrlPrefix}/refresh`. `getSession(req)` refreshes only when given an App Router `Request` (route handlers, where the cookie store can be written); without a request (Server Components, layouts) or with a Pages Router request it returns the stored session as is.
- **Client-side navigation:** the hydrated session ages while the tab stays open, and the browser never refreshes it. In your own client route guards, call `await sdk.refresh({ returnTo: <target path> })` for an expired session and cancel the navigation (framework references have the guard snippets).

## Worked example: Vue SPA + Express BFF

Layout: the SPA is served at `http://localhost:5173`, Express listens on `:3000`, and the Vite dev server proxies `/auth/*` to Express so everything is same-origin. Register `http://localhost:5173/callback` as the redirect URI and `http://localhost:5173` as the post-logout redirect URI.

### Server

```bash
npm install express @strivacity/sdk-core@next
npm install -D tsx @types/express
```

```ts
// server/bridge.ts - Express <-> Web Request/Response
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Readable } from 'node:stream';

export function toWebRequest(req: ExpressRequest): Request {
	const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
	const headers = new Headers();

	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		for (const v of Array.isArray(value) ? value : [value]) headers.append(key, v);
	}

	const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

	return new Request(url, {
		method: req.method,
		headers,
		...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
	} as RequestInit);
}

export async function applyResponse(response: Response, res: ExpressResponse): Promise<void> {
	res.status(response.status);

	for (const [key, value] of response.headers.entries()) {
		if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
	}

	const setCookies = response.headers.getSetCookie();
	if (setCookies.length) res.setHeader('set-cookie', setCookies);

	if (!response.body) {
		res.end();
		return;
	}

	await new Promise<void>((resolve, reject) => {
		Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
			.pipe(res)
			.on('finish', resolve)
			.on('error', reject);
	});
}
```

```ts
// server/index.ts - run with: npx tsx --env-file=.env server/index.ts
import express, { Router, type Request as ExpressRequest } from 'express';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { flushSetCookies } from '@strivacity/sdk-core/utils';
import { toWebRequest, applyResponse } from './bridge';

const sdk = createBaseServerSDK<ExpressRequest>(
	{ toRequest: (req) => toWebRequest(req) },
	{
		mode: 'redirect', // must match the SPA's mode
		issuer: process.env.STRIVACITY_ISSUER!, // https://<your-cluster-domain>
		clientId: process.env.STRIVACITY_CLIENT_ID!, // <your-client-id>
		redirectUri: process.env.STRIVACITY_REDIRECT_URI!, // http://localhost:5173/callback
		scopes: ['openid', 'profile', 'email'],
		cookieSecret: process.env.STRIVACITY_COOKIE_SECRET!, // openssl rand -base64 32
		postLoginRedirectUri: '/profile',
	},
);

const auth = Router();

function mount(method: 'get' | 'post', path: string, handler: (req: ExpressRequest) => Promise<Response>): void {
	auth[method](path, async (req, res, next) => {
		try {
			await applyResponse(await handler(req), res);
		} catch (error) {
			next(error);
		}
	});
}

mount('get', '/login', (req) => sdk.handleLogin(req));
mount('get', '/register', (req) => sdk.handleRegister(req));
mount('get', '/callback', (req) => sdk.handleCallback(req));
mount('get', '/refresh', (req) => sdk.handleRefresh(req));
mount('get', '/revoke', (req) => sdk.handleRevoke(req));
mount('get', '/entry', (req) => sdk.handleEntry(req));
mount('get', '/logout', (req) => sdk.handleLogout(req));
mount('post', '/backchannel-logout', (req) => sdk.handleBackChannelLogout(req));

// App code, NOT an SDK route: expose only what the UI needs - never the raw tokens.
auth.get('/session', async (req, res) => {
	try {
		const session = await sdk.getSession(req); // refreshes near expiry: write the rotated cookie
		for (const cookie of flushSetCookies(req, new Response(null)).headers.getSetCookie()) res.append('set-cookie', cookie);
		res.set('cache-control', 'no-store').json({ claims: session?.claims ?? null, expiresAt: session?.expires_at ?? null });
	} catch (error) {
		res.status(500).json({ error: 'session_error', description: error instanceof Error ? error.message : 'Unknown error' });
	}
});

const app = express();
app.set('trust proxy', 1); // behind a TLS-terminating proxy, so req.protocol is https
app.use('/auth', auth); // mount BEFORE any body parser: backchannel-logout reads the raw body
app.listen(Number(process.env.PORT ?? 3000));
```

To protect your own API routes on the server, call `const session = await sdk.getSession(req)`, copy the queued cookies to the response (`flushSetCookies(req, new Response(null)).headers.getSetCookie()` → `res.append('set-cookie', ...)`), and use `session.access_token` server-side for downstream calls.

The Strivacity example backend returns the whole session from `/auth/session` and calls `sdk.updateSession()` on the client for demo purposes. That puts tokens back into JavaScript, so return only claims as shown here.

### SPA (Vue + Vite)

```ts
// vite.config.ts - dev proxy; keep the Host header (no changeOrigin) so redirects come back to :5173
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [vue()],
	server: { port: 5173, proxy: { '/auth': { target: 'http://localhost:3000' } } },
});
```

```ts
// src/main.ts (excerpt) - the BFF-specific option is serverSessionUri (plus authUrlPrefix if the server does not use '/auth')
app.use(
	createStrivacitySDK({
		mode: 'redirect',
		issuer: import.meta.env.VITE_STRIVACITY_ISSUER,
		clientId: import.meta.env.VITE_STRIVACITY_CLIENT_ID,
		redirectUri: import.meta.env.VITE_STRIVACITY_REDIRECT_URI, // same value as the server
		scopes: ['openid', 'profile', 'email'],
		serverSessionUri: '/auth/login', // login()/register() now navigate to the BFF
	}),
);
```

```ts
// src/session.ts - app-side session state read from the BFF
import { computed, ref } from 'vue';
import type { IdTokenClaims } from '@strivacity/sdk-vue';

const claims = ref<IdTokenClaims | null>(null);

export async function loadSession(): Promise<void> {
	const response = await fetch('/auth/session', { credentials: 'include' });
	claims.value = response.ok ? ((await response.json()).claims ?? null) : null;
}

export function useSession() {
	return { claims, isAuthenticated: computed(() => claims.value !== null) };
}
```

In BFF mode the client SDK holds no tokens, so `useStrivacity().isAuthenticated`, `idTokenClaims` and `accessToken` stay empty. Use `useSession()` for UI state and route guards (`await loadSession()` in `beforeEnter`, or once before `app.mount()`). Keep using `useStrivacity().login()` / `register()` to start flows. A plain link to `/auth/login?returnTo=/profile` also works.

Callback, logout and revoke pages forward the browser to the BFF:

```vue
<!-- src/pages/Callback.vue (route at redirectUri) -->
<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
	window.location.href = `/auth/callback${window.location.search}`; // never call handleCallback() in BFF mode
});
</script>

<template><p>Signing you in...</p></template>
```

```vue
<!-- src/pages/Logout.vue - use '/auth/revoke' instead for a local-only sign-out without the IdP page -->
<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
	window.location.href = '/auth/logout';
});
</script>

<template><p>Signing you out...</p></template>
```

To refresh: `await useStrivacity().refresh()` navigates to `/auth/refresh?returnTo=<current URL>`, which rotates the cookie and comes back; call `loadSession()` again after the page loads. Without a navigation: `const res = await fetch('/auth/refresh', { credentials: 'include' })`. Success is `res.status === 204`. On failure the route redirects to `/error`, and `fetch` follows the redirect, so check the status, not `res.ok`.

### Cookies, origins and CORS

- Same origin (recommended): proxy `/auth` from the app's host (Vite `server.proxy` in dev, nginx/ingress/CDN in prod). No CORS needed.
- Different port or subdomain of the same site (for example `app.example.com` and `api.example.com`): `SameSite=Lax` cookies are still sent. Enable CORS with credentials on the BFF (`cors({ origin: 'https://app.example.com', credentials: true })`) and use `fetch(..., { credentials: 'include' })`. Set absolute `postLoginRedirectUri` / `postLogoutRedirectUri`, because error redirects still use the BFF origin.
- Different site: `Lax` cookies are not sent on cross-site `fetch`. Prefer moving to the same origin. Otherwise pass `storage: createEncryptedCookieStorage(secret, adapter, { defaultCookieOptions: { sameSite: 'none', maxAge: 2592000 } })` (from `@strivacity/sdk-core/storages`) and expect third-party-cookie blocking in some browsers.
- Cookies are `Secure`. Browsers accept them on `http://localhost`, but other hosts need HTTPS.

## Back-channel logout

The IdP calls your server directly (for example after an admin ends a session, or the user logs out elsewhere). It sends `POST {authUrlPrefix}/backchannel-logout` with `Content-Type: application/x-www-form-urlencoded` and a signed `logout_token` JWT.

- Set the client's **Back-channel logout URI** in the Admin Console to `https://<your-app-domain>/auth/backchannel-logout`. It must be publicly reachable over HTTPS.
- The handler verifies the signature (JWKS), `iss`, `aud` (= `clientId`), `iat` within 120 s, `jti`, no `nonce`, the `http://schemas.openid.net/event/backchannel-logout` event and `sid` or `sub`. It rejects reused tokens (per process), then calls `storage.deleteByLogoutToken({ sid?, sub? })`.
- Responses: `200` deleted, `400` invalid token, body or content type, `500` storage delete failed, `501` storage has no `deleteByLogoutToken`.
- **The default encrypted-cookie storage has no `deleteByLogoutToken`, so the route returns `501`.** The session lives only in the browser's cookie, and the server has nothing to delete. To support it, keep sessions server-side behind a session-id cookie:

```ts
// server/storage.ts - session-id cookie + Redis (npm install redis); ESM ("type": "module") for top-level await
import type { Request as ExpressRequest } from 'express';
import { createClient } from 'redis';
import { createSessionIdCookieStorage } from '@strivacity/sdk-core/storages';
import type { SDKStorage, ServerAdapter, ServerStorage } from '@strivacity/sdk-core/types';
import { toWebRequest } from './bridge';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();
const TTL = 2592000; // 30 days

const sessions: ServerStorage = {
	get: (id) => redis.get(`sess:${id}`),
	async set(id, value) {
		const claims = JSON.parse(value)?.claims;
		await redis.set(`sess:${id}`, value, { EX: TTL });
		if (claims?.sid) await redis.sAdd(`sid:${claims.sid}`, id);
		if (claims?.sub) await redis.sAdd(`sub:${claims.sub}`, id);
	},
	async delete(id) {
		await redis.del(`sess:${id}`);
	},
	async deleteByLogoutToken({ sid, sub }) {
		const ids = [...(sid ? await redis.sMembers(`sid:${sid}`) : []), ...(sub ? await redis.sMembers(`sub:${sub}`) : [])];
		if (ids.length) await redis.del(ids.map((id) => `sess:${id}`));
	},
};

// Shared PKCE state store: required when more than one server instance runs
export const stateStorage: SDKStorage = {
	get: (key) => redis.get(key),
	async set(key, value) {
		await redis.set(key, value, { EX: 600 });
	},
	async delete(key) {
		await redis.del(key);
	},
};

export const adapter: ServerAdapter<ExpressRequest> = { toRequest: (req) => toWebRequest(req) };
export const storage = createSessionIdCookieStorage(adapter, sessions, { defaultCookieOptions: { maxAge: TTL } });
```

Pass the same `adapter` object as the first argument of `createBaseServerSDK(adapter, { ...options, storage, stateStorage })`. `cookieSecret` is then not needed. Without `maxAge` the session-id cookie is a browser-session cookie. `createServerMemoryStorage()` (from the same entry) implements `deleteByLogoutToken` too, but only for local development.

Do not pass a plain key-value store as `storage` directly. The SDK always uses the single key `storageKey`, so every user would share one session. Wrap it with `createSessionIdCookieStorage`.

## Common mistakes

| Mistake                                                                 | Symptom                                                | Fix                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| `cookieSecret` missing (and no custom `storage`)                        | `ConfigurationError: Missing SDK option: cookieSecret` | Set a server-only secret from `openssl rand -base64 32`           |
| Secret differs between instances, or was rotated                        | Random logouts, session always empty                   | Share one secret across instances. Rotating it signs everyone out |
| Secret exposed through `VITE_` / `NEXT_PUBLIC_`                         | Secret shipped in the JS bundle                        | Server-only env var, rotate immediately                           |
| `serverSessionUri` set but no backend route or proxy                    | `login()` lands on a 404 or the SPA's index.html       | Mount the routes and proxy `/auth` to the BFF                     |
| Client SDK `handleCallback()` called in BFF mode                        | `State not found` / PKCE errors                        | Forward `/callback` to `/auth/callback` with the query string     |
| Client SDK `logout()` / `revoke()` in BFF mode                          | Cookie stays and user is still logged in               | Navigate to `/auth/logout` or `/auth/revoke`                      |
| Server SDK uses a non-default `authUrlPrefix`, client left at `'/auth'` | `refresh()` and the guards navigate to a 404           | Set the same `authUrlPrefix` on the client                        |
| Reading `useStrivacity().isAuthenticated` in a BFF SPA                  | Always `false` (the client SDK gets no session)        | Use the app's session endpoint                                    |
| Several instances or serverless with the default `stateStorage`         | Callback fails with "State not found or expired"       | Shared `stateStorage` (Redis, KV)                                 |
| Plain KV store as `storage`                                             | All users see the same session                         | Wrap with `createSessionIdCookieStorage`                          |
| SPA and BFF on different sites / missing `credentials: 'include'`       | Session endpoint returns no claims after login         | Same origin via proxy, or CORS with credentials (see above)       |
| Dev proxy with `changeOrigin: true`, or no `trust proxy` behind TLS     | Redirects go to `:3000` or `http://`                   | Keep the Host header and set `app.set('trust proxy', 1)`          |
| Body parser (`express.urlencoded()`) before the auth router             | Back-channel logout `400 Failed to parse request body` | Mount `/auth` first, or exclude it from body parsing              |
| Back-channel logout URI configured as GET / default cookie storage      | 404 / `501`                                            | It is `POST` only. Use a storage with `deleteByLogoutToken`       |
| `mode` or `redirectUri` differs between SPA and server                  | Invalid redirect URI, or embedded/native flows break   | Use identical values on both sides                                |
| Returning the raw session from `/auth/session`                          | Tokens readable by JavaScript again                    | Return claims (and expiry) only                                   |

More detail: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core (Server SDK section) and https://docs.strivacity.com/reference/overview
