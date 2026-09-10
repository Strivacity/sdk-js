# Strivacity Vue example app

A Vue 3 SPA demonstrating [`@strivacity/sdk-vue`](../../packages/sdk-vue) - it shows all four authentication modes (`redirect`, `popup`, `embedded`, `native`) side by side, route guarding, token refresh/revoke, and pairing with the [backend (BFF) app](../backend) for server-managed sessions.

**See also:**

- [Full Documentation](https://docs.strivacity.com/reference/overview) - complete guide for all authentication modes
- [Example apps overview](../README.md) - how pages, modes, and session strategies work across every example app
- [`@strivacity/sdk-vue` README](../../packages/sdk-vue/README.md) - the SDK this app is built on, including its full configuration reference
- [Root README](../../README.md) - monorepo setup, environment configuration, and running other example apps

---

## Running this app

From the repository root (see the [root README](../../README.md#environment-configuration) for the required `.env.local`):

```bash
pnpm app:vue:serve
```

Switch between modes by setting `VITE_MODE` (`redirect`, `popup`, `embedded`, or `native`) in `.env.local`.

---

## Project structure

- `src/pages` - one route per demo screen (`Home`, `Login`, `Register`, `Callback`, `Logout`, `Revoke`, `Profile`, `Entry`, `Error`)
- `src/components/auth` - one folder per mode (`redirect`, `popup`, `embedded`, `native`); `components/auth/index.ts` picks the active one based on `VITE_MODE`

---

## Native mode renderer

In `native` mode, Strivacity sends back the login flow as structured data (a `layout` tree plus per-screen `forms`) instead of markup, so your own components render the UI. This app's renderer for that is:

- [`NativeLoginRenderer.vue`](./src/components/auth/native/NativeLoginRenderer.vue) - entry point; renders the root layout widget (a `<form>`) and hands its child items to the widget renderer
- [`NativeLoginWidgetRenderer.ts`](./src/components/auth/native/NativeLoginWidgetRenderer.ts) - walks the layout tree recursively; for each placeholder, looks up its live widget data (value, validation messages) by id in the current form state and picks the matching component from the `widgets` map
- `native/widgets/` - one Vue component per widget type (`InputWidget`, `PasswordWidget`, `SelectWidget`, `SubmitWidget`, `PasskeyLoginWidget`, ...), each responsible for rendering and updating a single field

For the full explanation of `native` mode's data model (layout, forms, screens, messages) and event lifecycle, see the [native journey documentation](https://docs.strivacity.com/reference/native-journey) and the [core SDK's native mode section](../../packages/sdk-core/README.md#client-native-mode).
