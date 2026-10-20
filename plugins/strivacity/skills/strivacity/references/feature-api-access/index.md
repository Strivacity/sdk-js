# Access tokens for your APIs (`audiences`)

Ask Strivacity for an access token that your own API accepts, then send it as a `Bearer` token. The SDK login parameter for this is `audiences` (the `audience` request parameter). It is passed per call to `login()` / `register()` (or `startSession()` / `params` in embedded and native mode). It is not an `SDKOptions` field.

## Critical rules

- **Pass it on every login call that needs it.** There is no SDK option for a default audience. Wrap `login()` in one helper so that no call site forgets it.
- **It only affects the authorization request.** The code exchange and the refresh request do not repeat it (see "What the SDK sends"). The token's audience is decided when the user signs in.
- **Use exact identifiers.** The values must match what is configured for the API in the Strivacity Admin Console, character for character (scheme, host, path, trailing slash).
- **Your API must validate the token.** Check signature (JWKS from `https://<your-cluster-domain>/.well-known/openid-configuration`), `iss`, `exp` and `aud` on the API side. The SDK never validates access tokens.
- **The ID token is not an API token.** Never send `idToken` to an API. Its `aud` is your `clientId`.

## When to use it

| Use                   | When                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `audiences: string[]` | Your Strivacity setup identifies the API by an audience value. Values are joined with spaces into one `audience` parameter. |
| nothing               | You only need the user's identity (ID token claims), or the default access token already works for your API.                |

Check how the API is registered in your tenant: https://docs.strivacity.com/reference/overview

## What the SDK sends

### Authorization request (`login()`, `register()`, embedded / native `startSession()`)

`buildAuthorizationUrl` in `@strivacity/sdk-core/utils` adds it to the authorize URL:

| Param       | Wire format                                                                | Empty values                                       |
| ----------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| `audiences` | `audience=<v1> <v2>` (one parameter, space-joined, `url.searchParams.set`) | Falsy entries are filtered out. `[]` sends nothing |

```text
<authorization_endpoint from discovery>?client_id=...&scope=openid%20profile
  &audience=https%3A%2F%2Fapi.example.com%20https%3A%2F%2Fbilling.example.com
```

The filtered array is also stored in the PKCE state entry (`metadata.audiences` under the key `sty.<state>` in `stateStorage`). Nothing in the SDK reads it back. It is not forwarded to the token endpoint.

### Token request (code exchange) and refresh request

What `exchangeCode` and `refreshToken` actually post (`application/x-www-form-urlencoded`):

| Request       | Body                                                                                  | `audience`                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Code exchange | `grant_type=authorization_code`, `client_id`, `redirect_uri`, `code_verifier`, `code` | not sent                                                                                                                  |
| Refresh       | `grant_type=refresh_token`, `client_id`, `refresh_token`                              | not sent by the flows (the low-level `refreshToken()` util accepts `audience`, but no flow or Server SDK route passes it) |

Consequences:

- The access token's audience comes from the authorization request only. Refreshed tokens get whatever the server grants for that refresh token.
- To switch to a different API audience, start a new login with the new values. If the user still has an IdP session, this is usually quick, but it is a full authorization round trip.

### Server-managed sessions (BFF)

With `serverSessionUri: '/auth/login'` the browser SDK sends the same parameters to your BFF instead of the IdP. The Server SDK route `GET {authUriPrefix}/login` (`handleLogin`) reads `audience` (space-separated) back into `audiences`. Fallback: a space-separated `audiences` query param.

So `login({ audiences: [...] })` in the browser and a plain link `/auth/login?audience=https%3A%2F%2Fapi.example.com&returnTo=/orders` both work. `register()` goes through `/auth/register` with the same parsing. The Server SDK then builds the IdP authorize URL with the same format as above, and its token and refresh requests are the same as above.

## Requesting the token

The call shape is the same in every wrapper: pass the array to `login()` / `register()`.

| Framework                              | Where `login` comes from                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| React, Preact, Next.js (client), Solid | `const { login } = useStrivacity()`                                                                            |
| Vue, Nuxt                              | `const { login } = useStrivacity()` (Nuxt: auto-imported)                                                      |
| Svelte                                 | `const auth = useStrivacity()` → `auth.login(...)`                                                             |
| Angular                                | `inject(StrivacityAuthService).login(...)`                                                                     |
| Embedded                               | `element.params = { audiences: [...] }` on `<sty-login>`                                                       |
| Native                                 | `useNativeLogin({ params: { audiences: [...] } })` (Angular: `StrivacityNativeLoginService.start({ params })`) |

```ts
// src/auth/api-login.ts - one place that knows which APIs the app calls
import type { ExtraRequestArgs } from '@strivacity/sdk-react'; // same type from every wrapper

export const API_TOKEN_PARAMS: ExtraRequestArgs = {
	audiences: ['https://api.example.com'],
};
```

```tsx
// React (same in Preact, Solid, Next.js 'use client' components)
import { useStrivacity } from '@strivacity/sdk-react';
import { API_TOKEN_PARAMS } from './auth/api-login';

export function LoginButton() {
	const { login, loading } = useStrivacity();

	return (
		<button disabled={loading} onClick={() => void login({ ...API_TOKEN_PARAMS })}>
			Log in
		</button>
	);
}
```

```ts
// Angular
import { Component, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';
import { API_TOKEN_PARAMS } from './auth/api-login';

@Component({
	selector: 'app-login',
	template: `
		<button (click)="login()">Log in</button>
	`,
})
export class LoginComponent {
	private readonly auth = inject(StrivacityAuthService);

	login(): void {
		void this.auth.login({ ...API_TOKEN_PARAMS });
	}
}
```

## Calling the API

### Client-managed session

Get the token from the SDK right before each request. `checkAuthentication()` refreshes the token when it is within `refreshSkew` seconds (default `60`) of expiry and a refresh token exists. The SDK has no background refresh timer.

```ts
// src/auth/api-fetch.ts
import type { SDK } from '@strivacity/sdk-react'; // or sdk-vue, sdk-angular, sdk-preact, ...

// Pick<> so that every flow type (redirect, popup, embedded, native) fits
export async function apiFetch(sdk: Pick<SDK, 'checkAuthentication' | 'accessToken'>, input: string, init: RequestInit = {}): Promise<Response> {
	const authenticated = await sdk.checkAuthentication();

	if (!authenticated || !sdk.accessToken) {
		throw new Error('Not authenticated');
	}

	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${sdk.accessToken}`);

	return fetch(input, { ...init, headers });
}
```

Pass the flow instance: `useStrivacity().sdk` (React, Preact, Solid, Vue, Nuxt, Svelte) or `inject(StrivacityAuthService).sdk` (Angular). Read `sdk.accessToken` after the `await`, not a value captured in a component render, because the refresh replaces it.

On a `401` from your API, check the token's `aud` first (decode it with `decodeJwt` from the wrapper package, for debugging only). A missing or wrong `aud` means the login did not request the right audience. Do not retry in a loop.

### Server-managed session (BFF)

The browser never sees the access token. Call the API from the server with the session's token, or proxy browser requests through a server route:

```ts
// server: Express BFF route (sdk = createBaseServerSDK(...) from @strivacity/sdk-core/server)
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { flushSetCookies } from '@strivacity/sdk-core/utils';
import type { BaseServerSDK } from '@strivacity/sdk-core/types';

export async function proxyOrders(sdk: BaseServerSDK<ExpressRequest>, req: ExpressRequest, res: ExpressResponse): Promise<void> {
	// Refreshes a session within refreshSkew of expiry (once per request). A failed refresh clears the session and resolves to null
	const session = await sdk.getSession(req);

	// The rotated session is queued as Set-Cookie on the request's cookie jar: copy it to the Express response
	const cookies = flushSetCookies(req, new Response(null)).headers.getSetCookie();
	if (cookies.length) res.append('set-cookie', cookies);

	if (!session?.access_token) {
		res.status(401).json({ error: 'not_authenticated' });
		return;
	}

	const upstream = await fetch('https://api.example.com/orders', { headers: { Authorization: `Bearer ${session.access_token}` } });
	res.status(upstream.status).json(await upstream.json());
}
```

The built-in route handlers flush the cookie jar for you, and so do the SvelteKit `handle` and SolidStart `middleware` for every response that passes through them. In your own Express (or other plain Node) routes, `getSession` / `updateSession` / `refreshSession` only queue `Set-Cookie` headers for the request object, so flush them as shown, or redirect the browser through `/auth/refresh?returnTo=<path>` instead. Next.js: `await sdk.getSession(req)` with the App Router `Request` in a route handler from `@strivacity/sdk-next/server` refreshes and writes the cookie through `cookies()`; without a request (Server Components) or with a Pages Router request it returns the stored session without refreshing. Nuxt: `await event.context.strivacity.sdk.getSession()` in a server route. SvelteKit and SolidStart: `getSession(event)` refreshes, and `handle` / `middleware` write the cookie. Angular SSR (Express): `getSession(req)` plus the same flush as above.

## Common mistakes

| Mistake                                                          | Symptom                                                   | Fix                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| Expecting `audiences` in `SDKOptions` or `initFlow()`            | Ignored, token has no API audience                        | Pass it to `login()` / `register()` / `startSession()` params        |
| Passing a string instead of an array                             | TypeScript error, or the string is iterated / mis-encoded | `audiences: ['https://api.example.com']`                             |
| Adding `audiences` only to `login()` and not `register()`        | Users who just signed up get a token your API rejects     | Spread the same helper object into both calls                        |
| Identifier differs from the Admin Console (trailing slash, http) | `401` from the API, `aud` mismatch, or an OIDC error      | Copy the exact value                                                 |
| Expecting a refresh to change the audience                       | Old `aud` after changing the login params                 | Audience is fixed at login. Start a new login                        |
| Sending the ID token to the API                                  | `401`, `aud` = your client ID                             | Send `sdk.accessToken`                                               |
| Reading `accessToken` captured at render time                    | Intermittent `401` after expiry                           | `await sdk.checkAuthentication()` then read `sdk.accessToken`        |
| BFF: link to `/auth/login` without the params                    | Server session token lacks the audience                   | Use `login({ ...API_TOKEN_PARAMS })` or add `?audience=` to the link |
| BFF: exposing the access token to the browser to call the API    | Tokens readable by JavaScript again                       | Call the API from the server, or proxy through a server route        |
| API does not validate `aud`                                      | Tokens for other APIs are accepted                        | Validate `iss`, `aud`, `exp` and the signature in the API            |

More detail: https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-core and https://docs.strivacity.com/reference/overview
