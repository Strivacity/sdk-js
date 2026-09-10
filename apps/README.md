# Example web applications

The web example applications demonstrates the same product on every supported framework: the same pages, the same 4 authentication modes, and the same two session strategies. Only the implementation is framework-specific. Understanding one app is enough to understand all of them; use this document as the map, and each app's own `README.md` for its framework-specific file paths.

> 📘
>
> These are reference demos: every app deliberately shows all four authentication modes and both session strategies side by side, switched by an environment variable, with inline comments such as "keep only the branch matching your `serverSessionUri` setting". When adapting an app for production, pick a single mode and a single session strategy and remove the other branches instead of keeping the side-by-side structure.

## How it works

1. The user opens the app's Login or Register page, which renders the currently active authentication mode (see [Authentication modes](#authentication-modes)).
2. The mode drives the flow: a full-page redirect or pop-up to the hosted login page, an embedded `<sty-login>` widget, or a fully app-rendered native UI.
3. In `redirect`/`popup` mode, the identity provider returns the browser to the Callback page, which completes the flow. In `embedded`/`native` mode, the flow completes in place.
4. Depending on the session strategy (see [Session strategies](#session-strategies)), tokens are held in the browser or kept server-side and exposed to the app only as decoded claims.
5. The authenticated user lands on the Profile page, which displays the current session. Logout and Revoke end or clear the session from there.

## Client configuration

Each mode requires a matching client type for your application in the Strivacity Admin Console. Switching `VITE_MODE` without matching the client type in the Admin Console is a common source of confusing errors.

| Mode                  | Required client type            |
| :-------------------- | :------------------------------ |
| `redirect` / `popup`  | OIDC using no-code components   |
| `embedded` / `native` | OIDC using the Journey Flow API |

For the Entry page to work (password-reset and other externally-initiated flows), configure the **Entry URL** in the same client settings to point at the running app's `/entry` route (for example `http://localhost:4200/entry`).

> 📘
>
> See [Client configuration](https://docs.strivacity.com/reference/sdks#client-configuration) in the Strivacity documentation for the full setup, including passkey/WebAuthn trusted origins.

## Pages

Every app exposes the same set of pages, organized per the framework's own routing convention.

| Page         | Purpose                                                                                                                                                                                                                                                                 |
| :----------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**     | Landing page.                                                                                                                                                                                                                                                           |
| **Login**    | Renders the active mode's login UI.                                                                                                                                                                                                                                     |
| **Register** | The same component as Login, given `flowType="register"` instead of `"login"`.                                                                                                                                                                                          |
| **Callback** | Landing target for the identity provider's authorization response (`redirect`/`popup` mode). Reads `code`, `error`, and `error_description` from the query string and redirects to the Error page on failure. On success, its behavior depends on the session strategy. |
| **Logout**   | Ends the session and redirects to the identity provider's end-session endpoint. Behavior depends on the session strategy.                                                                                                                                               |
| **Revoke**   | Revokes the current access and refresh tokens and clears the local session. Behavior depends on the session strategy.                                                                                                                                                   |
| **Profile**  | A protected page, reachable only when authenticated (a route guard or middleware redirects unauthenticated visitors to Login). Displays the current session: ID token, access token with its expiry, and refresh token, with a control to trigger a refresh.            |
| **Entry**    | The resolution point for externally-initiated flows, such as a password-reset or verification link the user opens directly. Relevant to `embedded`/`native` mode only: it resolves the flow parameters and redirects to Login with them attached.                       |
| **Error**    | A generic error display. Reads `error`, `error_description`, or `message` from the query string. Every other page redirects here on failure.                                                                                                                            |

## Authentication modes

Every app shows all authentication modes side by side, selected via the `VITE_MODE` environment variable (see the root [environment configuration](../README.md#environment-configuration)).

| Mode       | Behavior                                                                                                                                                                                 |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redirect` | Full-page navigation to the identity provider's hosted login page, then back to the app's Callback page.                                                                                 |
| `popup`    | The hosted login page opens in a pop-up window or in a new tab instead of navigating away; the app resumes once the pop-up posts back the result.                                        |
| `embedded` | The identity provider's hosted login UI is mounted inline on the app's own page via the `<sty-login>` web component. The user never leaves the page.                                     |
| `native`   | The app renders its own UI. The identity provider returns structured data (a screen state with `forms` and `widgets`) instead of markup, and the app renders it with its own components. |

> 📘
>
> Each app organizes its mode components identically: one folder per mode (`redirect`/`popup`/`embedded`/`native`) under a shared `components/auth`-style directory, with an entry file that picks the active mode from `VITE_MODE`. Login and Register render whichever mode component is active, passing `flowType="login"` or `"register"`.

### Native mode rendering

In `native` mode, the identity provider returns a screen state instead of markup: a `layout` tree plus one or more `forms`, each holding a flat list of `widgets`. Every app implements the same small renderer to turn that state into UI, matching the [SDK's built-in renderer](https://docs.strivacity.com/reference/native-journey) model:

| Piece                           | Responsibility                                                                                                                                                                                            |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`NativeLoginRenderer`**       | Entry point. Renders the root layout widget (a `<form>`) and hands its child items to the widget renderer.                                                                                                |
| **`NativeLoginWidgetRenderer`** | Walks the layout tree recursively. For each placeholder, looks up its live widget data (value, validation messages) by id in the current form state and picks the matching component from the widget map. |
| **`native/widgets/`**           | One component per widget type (`InputWidget`, `PasswordWidget`, `SelectWidget`, `SubmitWidget`, `PasskeyLoginWidget`, and so on), each responsible for rendering and updating a single field.             |

If a screen or widget type isn't recognized (for example, a widget type the app hasn't implemented yet), the renderer falls back to the hosted journey instead of failing: it calls an `onFallback`/`triggerFallback` callback with the screen state's `hostedUrl`, and the app redirects the browser there. Every app's `native/widgets/` and `NativeLogin` component already wires this up; keep it in place when adding new widget types so an unrecognized screen degrades gracefully instead of hitting a dead end.

> 📘
>
> If you need full control over rendering, you can implement your own renderer while still using the SDK for session and flow management. See [Headless rendering](#headless-rendering) below.

For the full native mode data model and event lifecycle, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey) and [`packages/sdk-core/README.md`](../packages/sdk-core/README.md#client-native-mode).

#### Headless rendering

Every framework SDK also exposes a headless primitive underneath its built-in renderer. It drives the native flow without rendering anything itself, returning the current screen state (`state`, `forms`, `messages`, `loading`) and actions (`submitForm()`, `setFormValue()`) to advance it. `NativeLoginRenderer`/`NativeLoginWidgetRenderer` is only this demo's own generic way of consuming that state; the SDK does not require it.

If the generic renderer's layout does not fit your design, call the headless hook directly and render fully custom markup by reading the screen state yourself, screen by screen. Every app's `NativeLogin` component already demonstrates this in part: its `password` screen looks up that screen's widgets by hand and renders bespoke markup instead of delegating to `NativeLoginWidgetRenderer`, while every other screen still falls back to the generic renderer. The same technique scales up to replacing the generic renderer entirely.

## Session strategies

Every app supports two session strategies, controlled by a single SDK option: `serverSessionUri`.

### Client-managed sessions

Without `serverSessionUri`, the client SDK talks to the identity provider directly from the browser and stores tokens itself (`localStorage` by default). This is the default for the SPA-only apps: Vue.js, React, and Preact.

### Server-managed sessions

Setting `serverSessionUri` switches the client SDK into server-managed mode, the [BFF](../README.md#bff) pattern:

- Login and Register requests are routed through your own server endpoint instead of going straight to the identity provider.
- Tokens are never read from or written to client-side storage. They are kept server-side, typically in an encrypted, `http-only` cookie, by a **Server SDK** instance built on `@strivacity/sdk-core`'s server implementation.
- The client only ever sees decoded claims, never the raw tokens. How those claims reach the client depends on whether the app has its own server: SPA-only apps (paired with an example Express backend) fetch them client-side from a small session endpoint; SSR-capable apps instead read the session server-side during rendering (a loader, layout, or middleware) and pass the claims straight into the server-rendered page, with no client-side fetch needed.

| Page                   | Client-managed                                                                                       | Server-managed                                                                                                                                                                                                                                                                              |
| :--------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login / Register       | The SDK drives the flow directly (redirect/pop-up navigation, embedded widget, or native API calls). | The browser is sent straight to the server's login/register endpoint (for example `/auth/login`), since `serverSessionUri` is baked into the authorization URL the SDK builds.                                                                                                              |
| Callback               | Calls the client SDK's `handleCallback()` to exchange the code for tokens client-side.               | Forwards the browser to the server's callback endpoint (for example `/auth/callback`); the server exchanges the code and sets the session cookie.                                                                                                                                           |
| Logout                 | Calls the client SDK's `logout()`.                                                                   | Forwards the browser to the server's logout endpoint.                                                                                                                                                                                                                                       |
| Revoke                 | Calls the client SDK's `revoke()`.                                                                   | Forwards the browser to the server's revoke endpoint.                                                                                                                                                                                                                                       |
| Profile / session read | Reads `sdk.session` and tokens directly from client storage.                                         | SPA apps fetch a session endpoint (for example `/auth/session`) that calls the Server SDK's `getSession(request)` and returns only the safe, decoded claims as JSON. SSR-capable apps call `getSession(request)` server-side during rendering and bridge the claims straight into the page. |

> 📘
>
> See [Server-side session management](../packages/sdk-core/README.md#server-side-session-management) and [Server SDK](../packages/sdk-core/README.md#server-sdk) in the core SDK README for the underlying mechanics.

> 📘
>
> Pairing an SPA-only app with the standalone `backend` requires `credentials: 'include'` on every fetch to it, and CORS configured on the backend to allow the app's origin with credentials. Custom request headers sent to the identity provider (for example, in a custom `httpClient`) must also be listed in the Strivacity cluster's `Access-Control-Allow-Headers` configuration.

## Applications

Every framework's SDK ships a Server SDK usable as a BFF, but the example apps differ in whether server-managed sessions are wired up, enabled by default, and whether the app has its own server at all.

| App                              | Has its own server                        | Server-managed sessions     |
| :------------------------------- | :---------------------------------------- | :-------------------------- |
| [Vue.js](../apps/vue)            | No (SPA)                                  | Opt-in, disabled by default | Pairs with the standalone [backend](../apps/backend) Express BFF. Uncomment `serverSessionUri: '/auth/login'` to enable. |
| [React](../apps/react)           | No (SPA)                                  | Opt-in, disabled by default | Pairs with the standalone [backend](../apps/backend) Express BFF. Uncomment `serverSessionUri: '/auth/login'` to enable. |
| [Preact](../apps/preact)         | No (SPA)                                  | Opt-in, disabled by default | Pairs with the standalone [backend](../apps/backend) Express BFF. Uncomment `serverSessionUri: '/auth/login'` to enable. |
| [Angular](../apps/angular)       | Yes (Angular SSR with Express)            | Enabled by default          |                                                                                                                          |
| [Next.js](../apps/next)          | Yes (App Router route handlers)           | Enabled by default          |                                                                                                                          |
| [Nuxt](../apps/nuxt)             | Yes (Nuxt/Nitro)                          | Enabled by default          |                                                                                                                          |
| [SolidStart](../apps/solidstart) | Yes (own server, `server.js`)             | Enabled by default          |                                                                                                                          |
| [SvelteKit](../apps/sveltekit)   | Yes (SvelteKit hooks/`+layout.server.ts`) | Enabled by default          |                                                                                                                          |

SPA-only frameworks (Vue.js, React, Preact) have no server of their own, so server-managed sessions require pairing with the separate `backend` Express app. Every SSR-capable framework (Angular, Next.js, Nuxt, SolidStart, SvelteKit) wires its own Server SDK integration in-app and enables server-managed sessions by default, since it already has a server to run it on.

### The backend (BFF) app

[`backend`](../apps/backend) is a standalone Express server, not a demo app on its own. It exists to pair with the SPA-only apps (Vue.js, React, Preact) so they can demonstrate server-managed sessions without having a server of their own. Run it alongside one of those apps and point its `serverSessionUri` at it; see the root README's [Using the backend app with SPA apps](../README.md#using-the-backend-app-with-spa-apps).

It exposes one route per Server SDK operation, all mounted under `/auth`.

| Endpoint                        | Purpose                                                                        |
| :------------------------------ | :----------------------------------------------------------------------------- |
| `GET /auth/login`               | Starts the login flow, redirects to the identity provider.                     |
| `GET /auth/register`            | Starts the registration flow.                                                  |
| `GET /auth/callback`            | Receives the authorization response, exchanges the code for tokens.            |
| `GET /auth/refresh`             | Refreshes the access token.                                                    |
| `GET /auth/revoke`              | Revokes tokens, clears the session.                                            |
| `GET /auth/entry`               | Resolves flow parameters for externally-initiated flows.                       |
| `GET /auth/logout`              | Clears the session, redirects to the identity provider's end-session endpoint. |
| `POST /auth/backchannel-logout` | Receives back-channel logout notifications from the identity provider.         |
| `GET /auth/session`             | Returns the decoded session claims for the paired SPA to read.                 |

## Environment variables

Every app reads these from the repository-root `.env.local` (see the root [environment configuration](../README.md#environment-configuration) for the full setup).

| Variable         | Description                                                                       |
| :--------------- | :-------------------------------------------------------------------------------- |
| `VITE_MODE`      | Which authentication mode to demo: `redirect`, `popup`, `embedded`, or `native`   |
| `VITE_ISSUER`    | Your Strivacity cluster domain (for example `https://your-tenant.strivacity.com`) |
| `VITE_CLIENT_ID` | The client ID of your application                                                 |
| `VITE_SCOPES`    | Space-separated list of scopes to request (for example `openid profile`)          |
| `VITE_SECRET`    | encrypts the server-side session cookie                                           |

## Running the apps

```bash
pnpm app:<name>:serve        # e.g. pnpm app:vue:serve, pnpm app:nuxt:serve, ...
pnpm app:backend:serve       # Express BFF, only needed when pairing with vue/react/preact
```

## See also

- [Strivacity documentation overview](https://docs.strivacity.com/reference/overview)
- [Native journey](https://docs.strivacity.com/reference/native-journey)
- [Embedded journey](https://docs.strivacity.com/reference/embedded-journey)
- [Hosted journey](https://docs.strivacity.com/reference/hosted-journey)
- [`packages/sdk-core` README](../packages/sdk-core/README.md)
- [Root README](../README.md)
