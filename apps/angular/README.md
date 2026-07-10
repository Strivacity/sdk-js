# Strivacity Angular example app

An Angular (Angular SSR) app demonstrating [`@strivacity/sdk-angular`](../../packages/sdk-angular) - it shows all authentication modes (`redirect`, `popup`, `embedded`, `native`) side by side, route guards, token refresh/revoke, and server-managed sessions via the SDK's built-in Server SDK integration.

**See also:**

- [Full Documentation](https://docs.strivacity.com/reference/overview) - complete guide for all authentication modes
- [Example apps overview](../README.md) - how pages, modes, and session strategies work across every example app
- [`@strivacity/sdk-angular` README](../../packages/sdk-angular/README.md) - the SDK this app is built on, including its full configuration reference
- [Root README](../../README.md) - monorepo setup, environment configuration, and running other example apps

---

## Running this app

From the repository root (see the [root README](../../README.md#environment-configuration) for the required `.env.local`):

```bash
pnpm app:angular:serve
```

Switch between modes by setting `VITE_MODE` (`redirect`, `popup`, `embedded`, or `native`) in `.env.local`.

---

## Project structure

- `src/main.ts` / `src/main.server.ts` - client and SSR bootstrap entry points
- `src/app/pages` - one component per route (`home`, `login`, `register`, `callback`, `logout`, `revoke`, `profile`, `entry`, `error`)
- `src/app/components/auth` - one folder per mode (`redirect`, `popup`, `embedded`, `native`)
- `src/app/guards` - the `authGuard` route guard protecting `/profile`
- `src/server` - SSR server entry (`server.ts`) and the Server SDK wiring (`strivacity.ts`)
- `src/options.ts` - shared SDK options, including `serverSessionUri: '/auth/login'`

---

## Server-managed sessions

This app is SSR-capable and has its own server (`src/server/server.ts`), so it wires up the SDK's Server SDK directly (see `src/server/strivacity.ts`) rather than pairing with a separate backend. `serverSessionUri` is set to `/auth/login` by default in `src/options.ts`, routing login through this app's own server instead of storing tokens client-side.

---

## Native mode renderer

In `native` mode, Strivacity sends back the login flow as structured data (a `layout` tree plus per-screen `forms`) instead of markup, so your own components render the UI. This app's renderer for that is:

- [`native-login-renderer.ts`](./src/app/components/auth/native/native-login-renderer.ts) - entry point; renders the root layout widget (a `<form>`) and hands its child items to the widget renderer
- [`native-login-widget-renderer.ts`](./src/app/components/auth/native/native-login-widget-renderer.ts) - walks the layout tree recursively; for each placeholder, looks up its live widget data (value, validation messages) by id in the current form state and picks the matching component from the `widgets` map
- `native/widgets/` - one Angular component per widget type (`InputWidget`, `PasswordWidget`, `SelectWidget`, `SubmitWidget`, `PasskeyLoginWidget`, ...), each responsible for rendering and updating a single field

For the full explanation of `native` mode's data model (layout, forms, screens, messages) and event lifecycle, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey) and the [core SDK's native mode section](../../packages/sdk-core/README.md#client-native-mode).
