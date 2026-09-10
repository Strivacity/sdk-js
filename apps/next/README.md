# Strivacity Next.js example app

A Next.js (App Router) app demonstrating [`@strivacity/sdk-next`](../../packages/sdk-next) - it shows all four authentication modes (`redirect`, `popup`, `embedded`, `native`) side by side, server- and client-rendered routes, and server-managed sessions via the SDK's built-in Server SDK integration.

**See also:**

- [Full Documentation](https://docs.strivacity.com/reference/overview) - complete guide for all authentication modes
- [Example apps overview](../README.md) - how pages, modes, and session strategies work across every example app
- [`@strivacity/sdk-next` README](../../packages/sdk-next/README.md) - the SDK this app is built on, including its full configuration reference
- [Root README](../../README.md) - monorepo setup, environment configuration, and running other example apps

---

## Running this app

From the repository root (see the [root README](../../README.md#environment-configuration) for the required `.env.local`):

```bash
pnpm app:next:serve
```

Switch between modes by setting `VITE_MODE` (`redirect`, `popup`, `embedded`, or `native`) in `.env.local`.

---

## Project structure

- `app/` - App Router pages: `page.tsx` (home), `login/`, `register/`, `callback/`, `logout/`, `revoke/`, `profile/`, `entry/`, `error/`
- `app/lib/auth` - SDK options and server-side SDK wiring
- `components/auth` - one folder per mode (`redirect`, `popup`, `embedded`, `native`)
- `proxy.ts` - dev-only middleware that adds CORS headers to `/auth/:path*` responses

---

## Server-managed sessions

This app has its own server (Next.js's route handlers), so it wires up the SDK's Server SDK directly (see `app/lib/auth`) rather than pairing with a separate backend. `serverSessionUri` is set to `/auth/login` by default, routing login through this app's own server instead of storing tokens client-side.

---

## Native mode renderer

In `native` mode, Strivacity sends back the login flow as structured data (a `layout` tree plus per-screen `forms`) instead of markup, so your own components render the UI. This app's renderer for that is:

- [`NativeLoginRenderer.tsx`](./components/auth/native/NativeLoginRenderer.tsx) - entry point; renders the root layout widget (a `<form>`) and hands its child items to the widget renderer
- [`NativeLoginWidgetRenderer.tsx`](./components/auth/native/NativeLoginWidgetRenderer.tsx) - walks the layout tree recursively; for each placeholder, looks up its live widget data (value, validation messages) by id in the current form state and picks the matching component from the `widgets` map
- `native/widgets/` - one React component per widget type (`InputWidget`, `PasswordWidget`, `SelectWidget`, `SubmitWidget`, `PasskeyLoginWidget`, ...), each responsible for rendering and updating a single field

For the full explanation of `native` mode's data model (layout, forms, screens, messages) and event lifecycle, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey) and the [core SDK's native mode section](../../packages/sdk-core/README.md#client-native-mode).
