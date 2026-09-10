# Strivacity Nuxt example app

A Nuxt app demonstrating [`@strivacity/sdk-nuxt`](../../packages/sdk-nuxt) - it shows all four authentication modes (`redirect`, `popup`, `embedded`, `native`) side by side, and server-managed sessions via the SDK's Nuxt module, which auto-registers the Server SDK's auth routes and session middleware.

**See also:**

- [Full Documentation](https://docs.strivacity.com/reference/overview) - complete guide for all authentication modes
- [Example apps overview](../README.md) - how pages, modes, and session strategies work across every example app
- [`@strivacity/sdk-nuxt` README](../../packages/sdk-nuxt/README.md) - the SDK this app is built on, including its full configuration reference
- [Root README](../../README.md) - monorepo setup, environment configuration, and running other example apps

---

## Running this app

From the repository root (see the [root README](../../README.md#environment-configuration) for the required `.env.local`):

```bash
pnpm app:nuxt:serve
```

Switch between modes by setting `VITE_MODE` (`redirect`, `popup`, `embedded`, or `native`) in `.env.local`.

---

## Project structure

- `nuxt.config.ts` - the module's `strivacity: {...}` config (covers client and server options together)
- `app/pages` - file-based routes: `index.vue`, `login.vue`, `register.vue`, `callback.vue`, `logout.vue`, `revoke.vue`, `profile.vue`, `entry.vue`
- `app/components/auth` - one folder per mode (`redirect`, `popup`, `embedded`, `native`)
- `app/middleware` - the `auth` route middleware protecting `/profile`

---

## Server-managed sessions

`@strivacity/sdk-nuxt` is a Nuxt module with its own server integration - it auto-registers all auth routes and a session-hydration middleware, so this app never needs to pair with a separate backend. `serverSessionUri` defaults to `${authUrlPrefix}/login` in this SDK (server-managed sessions are the default here, unlike every other framework where it's opt-in) - see `nuxt.config.ts`. See the Core SDK's [Server-side session management](../../packages/sdk-core/README.md#server-side-session-management) for details.

---

## Native mode renderer

In `native` mode, Strivacity sends back the login flow as structured data (a `layout` tree plus per-screen `forms`) instead of markup, so your own components render the UI. This app's renderer for that is:

- [`NativeLoginRenderer.vue`](./app/components/auth/native/NativeLoginRenderer.vue) - entry point; renders the root layout widget (a `<form>`) and hands its child items to the widget renderer
- [`NativeLoginWidgetRenderer.ts`](./app/components/auth/native/NativeLoginWidgetRenderer.ts) - walks the layout tree recursively; for each placeholder, looks up its live widget data (value, validation messages) by id in the current form state and picks the matching component from the `widgets` map
- `native/widgets/` - one Vue component per widget type (`InputWidget`, `PasswordWidget`, `SelectWidget`, `SubmitWidget`, `PasskeyLoginWidget`, ...), each responsible for rendering and updating a single field

For the full explanation of `native` mode's data model (layout, forms, screens, messages) and event lifecycle, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey) and the [core SDK's native mode section](../../packages/sdk-core/README.md#client-native-mode).
