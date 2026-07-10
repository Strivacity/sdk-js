# Strivacity backend (BFF) example app

A standalone Express server implementing the [BFF](../../README.md#bff) (Backend-For-Frontend) pattern on top of [`@strivacity/sdk-core`'s Server SDK](../../packages/sdk-core/README.md#server-sdk) - it handles the OAuth 2.0 PKCE flow, stores tokens server-side in an encrypted `http-only` cookie, and exposes them to a paired client only as decoded claims.

This app is not a standalone example on its own - it's meant to be run alongside one of the SPA-only example apps ([`apps/vue`](../vue), [`apps/react`](../react), [`apps/preact`](../preact)), which talk to the identity provider directly by default but can be switched to route through this server instead.

**See also:**

- [Full Documentation](https://docs.strivacity.com/reference/overview) - complete guide for all authentication modes
- [Example apps overview](../README.md) - how pages, modes, and session strategies work across every example app
- [Core SDK Server-side session management](../../packages/sdk-core/README.md#server-side-session-management) - the client-side SDK option (`serverSessionUri`) this backend is designed to pair with
- [Root README - Using the backend app with SPA apps](../../README.md#using-the-backend-app-with-spa-apps) - how to run this app alongside a paired SPA

---

## Running this app

From the repository root (see the [root README](../../README.md#environment-configuration) for the required `.env.local`, plus a `VITE_SECRET` for cookie encryption):

```bash
pnpm app:backend:serve
```

Starts an Express server on `http://localhost:3000` (override with the `PORT` environment variable).

---

## Project structure

- `src/index.ts` - Express app entry point; configures CORS and mounts the auth router at `/auth`
- `src/handlers.ts` - creates the Server SDK instance and mounts each of its `handleXxx` methods as an Express route
- `src/utils.ts` - converts between Express's request/response objects and the standard `Request`/`Response` objects the Server SDK works with

---

## Endpoints

| Method | Path                       | Purpose                                                                                                                                                                            |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/auth/login`              | Starts the login flow and redirects to the identity provider                                                                                                                       |
| GET    | `/auth/register`           | Starts the registration flow                                                                                                                                                       |
| GET    | `/auth/callback`           | Receives the authorization response, exchanges the code for tokens                                                                                                                 |
| GET    | `/auth/refresh`            | Refreshes the access token using the stored refresh token                                                                                                                          |
| GET    | `/auth/revoke`             | Revokes the tokens and clears the session                                                                                                                                          |
| GET    | `/auth/entry`              | Resolves flow parameters for externally-initiated flows (e.g. password reset)                                                                                                      |
| GET    | `/auth/logout`             | Clears the session and redirects to the identity provider's end-session endpoint                                                                                                   |
| POST   | `/auth/backchannel-logout` | Receives back-channel logout notifications from the identity provider                                                                                                              |
| GET    | `/auth/session`            | Returns the full session data (`id_token`, `access_token`, `refresh_token`, `claims`, ...) for this example - not a fixed contract, expose whatever subset your app actually needs |

---

## Environment variables

In addition to the shared variables documented in the [root README](../../README.md#environment-configuration), this app reads:

| Variable      | Description                               |
| ------------- | ----------------------------------------- |
| `VITE_SECRET` | Secret used to encrypt the session cookie |
| `PORT`        | Port to listen on (default `3000`)        |
