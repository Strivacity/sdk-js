# Upgrade the Strivacity JS SDK from v3 to v4

Migrate an app that depends on `@strivacity/sdk-*` 3.x to 4.x. v4 replaces the class-based flows with factory functions, turns storages, logging and the HTTP client into plain objects, adds a first-class Server SDK for server-managed (BFF) sessions, and reshapes the framework wrappers.

## Critical rules

- **v4 is on the npm `next` dist-tag** (`4.0.0-beta.x`). `npm install @strivacity/sdk-react` without a tag still installs v3. Use `@next` or an exact 4.x version, and pin it (`--save-exact`).
- **Upgrade every `@strivacity/*` package together, to the same version.** Wrappers depend on an exact `@strivacity/sdk-core` version. Mixing majors puts two cores in the bundle and breaks types.
- **Ask before creating or editing `.env` files**, and never read an existing `.env*` file without permission. A Server SDK `cookieSecret` is server-only and must never get a `VITE_` / `NEXT_PUBLIC_` / `PUBLIC_` prefix.
- **Run the type-checker, the tests and one real login per mode after the upgrade.** Most breaking changes surface as TypeScript errors. The rest (event timing, Nuxt's server-session default) only show at runtime.
- Change one thing at a time. First reach v4 parity with the old behaviour (same mode, client-managed session). Adopt server-managed sessions afterwards, as a separate step.

## Detect current version

```bash
npm ls @strivacity/sdk-core   # or: pnpm why @strivacity/sdk-core / yarn why @strivacity/sdk-core
grep -rn '"@strivacity/' package.json
```

v3 code also shows these markers: deep imports with PascalCase file names (`@strivacity/sdk-core/flows/RedirectFlow`, `.../storages/LocalStorage`, `.../utils/Logging`), class options (`storage: LocalStorage`, `logging: DefaultLogging`), `mode: 'custom'` / `customFlow`, `waitToInitialize()`, `StyLoginRenderer`, `StrivacityWidgetService`, `session$`, `createCredential` / `getCredential`, and `@strivacity/sdk-remix`.

## Step-by-step checklist

1. Record the current behaviour: mode, routes (login, callback, logout, entry), storage, logging, custom flows, and native widgets.
2. Update all Strivacity packages in one command, for example `npm install --save-exact @strivacity/sdk-react@next`. Remove `@strivacity/sdk-core` from `package.json` if the app uses a wrapper and never imports core directly.
3. Check the framework peer versions (table below) and upgrade the framework first if needed.
4. Fix imports: drop PascalCase deep imports, and import from the wrapper root or the new subpaths (`/client`, `/server`, `/storages`, `/utils`, `/types`).
5. Make `mode` explicit in every options object.
6. Replace classes with factory calls: `createLocalStorage()`, `createSessionStorage()`, `createDefaultLogging()`, `createHttpClient()`. Rewrite custom storage, logging or HTTP classes as plain objects.
7. Replace `mode: 'custom'` + `customFlow` with `serverSessionUri` + the Server SDK (for BFF setups) or with `factory` + `createBaseFlow`.
8. Replace native-mode renderers (`StyLoginRenderer`, `NativeFlowContext`, `StrivacityWidgetService`, `NativeFlowHandler` calls) with `useNativeLogin()` / `StrivacityNativeLoginService` / `sdk.startSession()`.
9. Apply the framework-specific changes below (Angular signals, Next.js and Svelte subpaths, the Nuxt session default).
10. Rename types (`RedirectContext` → `SDKContext` / `useStrivacity<RedirectFlow>()`, `LoginFlowState` → `NativeFlowState`, ...).
11. Type-check, run the tests, and log in, refresh, log out and (if used) run an entry link in every mode the app uses.

## Peer dependencies

| Package                   | v3 peer              | v4 peer                                              |
| ------------------------- | -------------------- | ---------------------------------------------------- |
| `@strivacity/sdk-react`   | `react >=18`         | `react >=18`                                         |
| `@strivacity/sdk-vue`     | `vue >=3`            | `vue >=3.3`                                          |
| `@strivacity/sdk-angular` | `@angular/core >=14` | `@angular/core >=20`, `express >=5` (for `./server`) |
| `@strivacity/sdk-next`    | `next >=13`          | `next >=15`                                          |
| `@strivacity/sdk-nuxt`    | Nuxt 3               | `nuxt >=4.0`                                         |
| `@strivacity/sdk-svelte`  | `svelte >=5`         | `svelte >=5`, `@sveltejs/kit >=2`                    |
| `@strivacity/sdk-preact`  | (new in v4)          | `preact >=10`                                        |
| `@strivacity/sdk-solid`   | (new in v4)          | `solid-js >=2`, `@solidjs/web >=2`                   |

## Breaking changes (all packages)

| Area                             | v3                                                                                                                                                         | v4                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                           | Optional, defaulted to `'redirect'`                                                                                                                        | Required. Missing or unknown values throw `UnsupportedFlowError`                                                                                                                |
| Options type                     | `SDKOptions` (everything optional except issuer, clientId, redirectUri)                                                                                    | Pass `SDKInitConfig`. `SDKOptions` is now the resolved form with every field required                                                                                           |
| Options object                   | The SDK wrote its defaults (`scopes`, `responseMode`, `storageTokenName`, ...) into the object you passed                                                  | The SDK copies it and leaves your object unchanged. Read resolved values from `sdk.options`                                                                                     |
| Storage                          | `storage: LocalStorage` (a class, instantiated by the SDK)                                                                                                 | `storage: createLocalStorage()` (an object). Also `createSessionStorage`, `createMemoryStorage`, `createIndexedDBStorage`, `createCacheAPIStorage`, `createWorkerStorage`       |
| PKCE state                       | Stored in `storage` under `sty.<state>`                                                                                                                    | Separate `stateStorage`, default `createSessionStorage()`. A login started on v3 cannot finish on v4                                                                            |
| Logging                          | `logging: DefaultLogging` (class)                                                                                                                          | `logging: createDefaultLogging()`                                                                                                                                               |
| HTTP client                      | `httpClient: HttpClient` (class with `request`)                                                                                                            | `httpClient: createHttpClient()`. Custom clients need `request()` **and** `sendTokenRequest()`, and the logger property is `logger`                                             |
| Custom implementations           | `class X extends SDKStorage` / `SDKLogging` / `SDKHttpClient` (abstract classes)                                                                           | Those names are types now. Pass a plain object `{ get, set, delete }` / `{ debug, info, warn, error }`                                                                          |
| Custom flows                     | `mode: 'custom'`, `customFlow: class extends RedirectFlow`                                                                                                 | Removed. Use `factory: (options) => flow`, built by composing `createBaseFlow` from `@strivacity/sdk-core/flows`                                                                |
| Hand-rolled BFF                  | Custom flow class plus your own backend endpoints                                                                                                          | `serverSessionUri: '/auth/login'` on the client, plus the Server SDK (`createBaseServerSDK`, or the wrapper's `createServerSDK`)                                                |
| Native mode                      | `login()` returned a `NativeFlowHandler`: `handler.startSession(sessionId, language)`                                                                      | `sdk.startSession({ sessionId, language })`, `sdk.submitForm()`, `sdk.finalizeSession()`. `login()` still returns a deprecated handler whose `startSession` takes an **object** |
| Initialization                   | `await sdk.waitToInitialize()`                                                                                                                             | `await sdk.init()` (idempotent). `lazyLoad: true` skips the automatic start                                                                                                     |
| Removed flow members             | `getAuthorizationUrl()`, `sendTokenRequest()`, `refreshInProgress`                                                                                         | Gone. `checkAuthentication({ autoRefresh })`, `idToken`, `session`, `language`, `subscribeToAllEvents()` are new                                                                |
| Events                           | One global subscriber list shared by every flow instance                                                                                                   | Per instance. New events: `sessionUpdated`, `sessionCleared`, `flowInitiated`. Token events also carry `idToken`                                                                |
| `urlHandler` / `callbackHandler` | Received `url: string`                                                                                                                                     | Receive `string \| URL`. Call `String(url)` or `new URL(url)` in custom handlers                                                                                                |
| Errors import                    | `import { FallbackError } from '@strivacity/sdk-core'`                                                                                                     | The core root exports only `initFlow` and types. Import errors from `@strivacity/sdk-core/utils` (wrappers re-export them from their root)                                      |
| Deep imports                     | `flows/RedirectFlow`, `storages/LocalStorage`, `utils/HttpClient`, `utils/Logging`, `utils/Session`, `utils/object`                                        | Subpaths `flows`, `handlers`, `storages`, `utils`, `types`, `server` (plus lowercase single files such as `flows/base`, `utils/errors`)                                         |
| WebAuthn helpers                 | `createCredential(options)`, `getCredential(options, conditional)`                                                                                         | `createWebAuthnCredential(optionsJSON, abortController?)`, `assertWebAuthnCredential(optionsJSON, mediation?, abortController?)`                                                |
| Type names                       | `LoginFlowState`, `LoginFlowMessage`, `MetadataOptions`, `PromptType`, `FallbackMode`, `SDKStorageType`, `SDKLoggingType`, `SDKHttpClientType`, `FlowType` | `NativeFlowState`, `NativeFlowMessage`, `DiscoveryDocument`. The others are removed (`prompt` is a plain `string`)                                                              |
| `initFlow` typing (core only)    | Overloads inferred the flow type from `mode`                                                                                                               | Returns `unknown` unless you pass the type: `initFlow<RedirectFlow>({...})` (with `factory`, inferred from it)                                                                  |
| Wrapper context                  | Had an `options` field. Mode-specific types `RedirectContext`, `PopupContext`, `NativeContext`                                                             | `options` removed (use `sdk.options`). Use `useStrivacity<RedirectFlow>()`, whose type is `SDKContext<RedirectFlow>`                                                            |

New options in v4: `stateStorage`, `lazyLoad`, `refreshSkew` (`60`), `serverSessionUri` (`null`), `authUrlPrefix` (`'/auth'`), `discoveryDocumentCacheTTL` (`3600`), `jwksCacheTTL` (`600`), and the `display` login param. The session storage key is still `sty.session` by default.

### Core (`@strivacity/sdk-core`)

```ts
// v3
import { initFlow } from '@strivacity/sdk-core';
import { SessionStorage } from '@strivacity/sdk-core/storages/SessionStorage';
import { DefaultLogging } from '@strivacity/sdk-core/utils/Logging';
import { PopupBlockedError } from '@strivacity/sdk-core';

const sdk = initFlow({ issuer, clientId, redirectUri, storage: SessionStorage, logging: DefaultLogging });
await sdk.waitToInitialize();
```

```ts
// v4
import { initFlow } from '@strivacity/sdk-core';
import type { RedirectFlow } from '@strivacity/sdk-core';
import { createSessionStorage } from '@strivacity/sdk-core/storages';
import { createDefaultLogging, PopupBlockedError } from '@strivacity/sdk-core/utils';

const sdk = initFlow<RedirectFlow>({
	mode: 'redirect',
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'http://localhost:5173/callback',
	storage: createSessionStorage(),
	logging: createDefaultLogging(),
});
await sdk.init();
```

Custom storage class to object:

```ts
// v4 - was: class MyStorage extends SDKStorage { ... } and storage: MyStorage
import type { SDKStorage } from '@strivacity/sdk-core';

const values = new Map<string, string>();

export const myStorage: SDKStorage = {
	get: async (key) => values.get(key) ?? null,
	set: async (key, value) => void values.set(key, value),
	delete: async (key) => void values.delete(key),
};
```

Custom flow class to factory:

```ts
// v4 - was: class CustomFlow extends RedirectFlow { override async refresh() {...} } with mode: 'custom', customFlow: CustomFlow
import { initFlow } from '@strivacity/sdk-core';
import type { RedirectFlow, SDKInitConfig } from '@strivacity/sdk-core';
import { createRedirectFlow } from '@strivacity/sdk-core/flows';

function createCustomFlow(initConfig: SDKInitConfig): RedirectFlow {
	const flow = createRedirectFlow(initConfig);
	const refresh = flow.refresh;

	return Object.assign(flow, {
		async refresh(): Promise<void> {
			console.info('refreshing'); // your override
			await refresh();
		},
	});
}

const sdk = initFlow({
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'http://localhost:5173/callback',
	factory: createCustomFlow, // mode is optional with a factory; sdk is typed as RedirectFlow
});
```

Mutate the flow with `Object.assign` instead of spreading it: the built-in flows expose their state through getters, and `{ ...flow }` would copy a snapshot of them. Unlike a v3 subclass override, the replaced method is only used by your own calls: internal calls (for example the auto-refresh inside `checkAuthentication()`) still run the original. For a flow built from scratch, compose `createBaseFlow(getDefaultFlowState(), getSDKOptions(initConfig))` (from `@strivacity/sdk-core/flows` and `@strivacity/sdk-core/utils`).

Native mode without a wrapper:

```ts
// v3
const handler = sdk.login();
const state = await handler.startSession(sessionId);
```

```ts
// v4
const state = await sdk.startSession({ sessionId });
const next = await sdk.submitForm('identifier', { identifier: 'user@example.com' });
// When next.finalizeUrl is set, submitForm() has already finalized the session: do not call finalizeSession() again
```

### React, Preact and Next.js

```tsx
// v3
import { StyAuthProvider, useStrivacity, DefaultLogging } from '@strivacity/sdk-react';
import type { RedirectContext } from '@strivacity/sdk-react';

<StyAuthProvider options={{ issuer, clientId, redirectUri, logging: DefaultLogging }}>...</StyAuthProvider>;
const { login, options } = useStrivacity<RedirectContext>();
```

```tsx
// v4
import type { ReactNode } from 'react';
import { StyAuthProvider, useStrivacity, createDefaultLogging } from '@strivacity/sdk-react';
import type { RedirectFlow, SDKInitConfig } from '@strivacity/sdk-react';

const authOptions: SDKInitConfig = {
	mode: 'redirect',
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'http://localhost:5173/callback',
	logging: createDefaultLogging(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
	return <StyAuthProvider options={authOptions}>{children}</StyAuthProvider>;
}

export function LoginButton() {
	const { loading, login, sdk } = useStrivacity<RedirectFlow>(); // sdk.options replaces the old `options` field
	return (
		<button disabled={loading || !sdk.options.clientId} onClick={() => void login()}>
			Log in
		</button>
	);
}
```

- `StyLoginRenderer` and `NativeFlowContext` are removed. Use `useNativeLogin({ params, onLogin, onFallback, onClose, onError, onGlobalMessage })` and render `state.forms` yourself. Child widgets read the same state with `useNativeLoginContext()`. `onLogin` now receives the `SessionData` (v3: claims). `onGlobalMessage` receives a `NativeFlowMessage` (v3: a string). `triggerFallback(message?)` replaces `triggerFallback(hostedUrl?)`. The v3 props `widgets`, `onBlockReady` and `onLanguageChange` have no replacement.
- New: `withAuthGuard(Component, { loginUri, onLoading })`, `session` prop on `StyAuthProvider` (pre-fetched BFF session), and `language` in the context. The `session` prop is serialized into the rendered HTML, so remove `refresh_token` and `id_token` from it first.
- **Next.js:** the package root no longer has the client API. Import client code from `@strivacity/sdk-next/client` and server code from `@strivacity/sdk-next/server`. The v3 setup (client-managed, everything in `'use client'` components) keeps working when you only change the imports. The server-managed setup (`createServerSDK`, a catch-all `app/auth/[...strivacity]/route.ts`, `cookieSecret`, `serverSessionUri: '/auth/login'`) is opt-in.
- **Preact** (`@strivacity/sdk-preact`) is new in v4 and has the same API as `@strivacity/sdk-react`.

### Vue and Nuxt

```ts
// v4 - main.ts; `createStrivacitySDK` keeps its name, `mode` is now required
import { createApp } from 'vue';
import { createStrivacitySDK, createLocalStorage } from '@strivacity/sdk-vue';
import App from './App.vue';

createApp(App)
	.use(
		createStrivacitySDK({
			mode: 'redirect',
			issuer: 'https://<your-cluster-domain>',
			clientId: '<your-client-id>',
			redirectUri: 'http://localhost:5173/callback',
			storage: createLocalStorage(), // v3: storage: LocalStorage
		}),
	)
	.mount('#app');
```

- Vue: the global `<StyLoginRenderer>` component and the exported `isAuthenticated()` function are removed. Use `useNativeLogin()` for native mode, and `useStrivacity().isAuthenticated` (a `Ref<boolean>`) or `await useStrivacity().checkAuthentication()`. `useStrivacity<RedirectFlow>()` replaces `useStrivacity<RedirectContext>()`. The context has no `options` ref, so use `sdk.options`.
- **Nuxt: server-managed sessions are ON by default in v4.** When `serverSessionUri` is not set, the module sets it to `` `${authUrlPrefix}/login` ``, registers the Nitro routes under `/auth`, and requires a server-only `cookieSecret`. To keep v3's client-managed behaviour, set `serverSessionUri: null` (or `false`) explicitly. Omitting the option does not give you client-managed sessions.
- **Nuxt: `useStrivacity()` is read-only during SSR.** In v3 the SDK instance was a module-level singleton that was also created on the server and shared by concurrent requests. In v4 it exists only in the browser (a client plugin creates it, also available as `useNuxtApp().$strivacity`). During SSR, `useStrivacity()` returns a context built from the request's `useSession()`: the refs, `sdk.options` and `sdk.session` can be read, `checkAuthentication()` / `init()` resolve immediately, events are no-ops, and `login()`, `logout()`, `handleCallback()` and the other flow methods throw. Move such calls into `onMounted()` or event handlers.
- Nuxt: options that held classes (`storage`, `logging`) are replaced by file-path options (`storageFactoryPath`, `stateStorageFactoryPath`, `loggingFactoryPath`, `httpClientFactoryPath`), each pointing at a module that default-exports a factory function. The `StyLoginRenderer` component and the `createCredential` / `getCredential` auto-imports are gone. `useStrivacity`, `useNativeLogin`, `useNativeLoginContext` and `useSession` are auto-imported.

```ts
// nuxt.config.ts (v4, client-managed like v3)
export default defineNuxtConfig({
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		mode: 'redirect',
		issuer: 'https://<your-cluster-domain>',
		clientId: '<your-client-id>',
		redirectUri: 'http://localhost:3000/callback',
		serverSessionUri: false, // omit only if you want server-managed sessions (then `cookieSecret` is required)
	},
});
```

### Angular

| v3                                                                       | v4                                                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StrivacityAuthService` is `providedIn: 'root'`                          | Not root-provided. `provideStrivacity(config)` (returns `Provider[]`) or `StrivacityAuthModule.forRoot(config)` registers it                              |
| `auth.session$` (`Observable`) with `loading`, `isAuthenticated`, ...    | Read-only signals: `auth.loading()`, `auth.isAuthenticated()`, `auth.idTokenClaims()`, `auth.accessToken()`, ...                                          |
| `auth.isAuthenticated()` returned `Observable<boolean>`                  | `auth.isAuthenticated()` returns `boolean` (it is a signal). Use `await auth.checkAuthentication()` for a fresh check                                     |
| `auth.login()`, `logout()`, `handleCallback()`, ... returned Observables | They return Promises. Replace `.subscribe()` with `await` (or `from(...)`)                                                                                |
| `StyLoginRenderer`, `StrivacityWidgetService`                            | Removed. Use `StrivacityNativeLoginService` (provide it on the component, then `await nativeLogin.start({ params: { sessionId }, onLogin, onFallback })`) |
| `StrivacityAuthService<Flow>` generic                                    | Not generic. `auth.sdk` is typed as the union of flows                                                                                                    |

```ts
// v4 - component code; was: this.auth.session$.subscribe(...) and this.auth.login().subscribe()
import { Component, inject } from '@angular/core';
import { StrivacityAuthService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-header',
	template: `
		@if (!auth.loading()) {
			@if (auth.isAuthenticated()) {
				<span>{{ auth.idTokenClaims()?.['email'] }}</span>
				<button (click)="logout()">Log out</button>
			} @else {
				<button (click)="login()">Log in</button>
			}
		}
	`,
})
export class HeaderComponent {
	readonly auth = inject(StrivacityAuthService);

	async login(): Promise<void> {
		await this.auth.login();
	}

	async logout(): Promise<void> {
		await this.auth.logout({ postLogoutRedirectUri: window.location.origin });
	}
}
```

Angular SSR with server-managed sessions is opt-in: `createServerSDK` from `@strivacity/sdk-angular/server`, its Express `handlers` router, and `provideStrivacityServerSession(serverSdk)`. The latter hands the session to the browser through `TransferState` without the refresh and ID tokens.

### Svelte / SvelteKit

The package has no root export in v4. Import from `@strivacity/sdk-svelte/client` or `@strivacity/sdk-svelte/server`. The `<StyAuthProvider>` and `<StyLoginRenderer>` components are replaced by functions:

```svelte
<!-- v3: src/routes/+layout.svelte -->
<script>
	import { StyAuthProvider } from '@strivacity/sdk-svelte';
	let { children } = $props();
</script>

<StyAuthProvider {options}>{@render children()}</StyAuthProvider>
```

```svelte
<!-- v4: src/routes/+layout.svelte -->
<script lang="ts">
	import { createStyAuthProvider } from '@strivacity/sdk-svelte/client';
	import { sdkOptions } from '$lib/options';
	let { children } = $props();

	createStyAuthProvider({ options: sdkOptions }); // call during component init, not in onMount
</script>

{@render children()}
```

Native mode uses `useNativeLogin()` from `@strivacity/sdk-svelte/client`.

## Removed packages and replacements

| v3 package / API                                                                        | Replacement in v4                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@strivacity/sdk-remix`                                                                 | No Remix wrapper in v4. Client-rendered Remix / React Router apps: `@strivacity/sdk-react` (same `StyAuthProvider` / `useStrivacity` API). Server-side sessions: `createBaseServerSDK` from `@strivacity/sdk-core/server` with `{ toRequest: (request: Request) => request }`, called from a resource route |
| `mode: 'custom'`, `customFlow`                                                          | `serverSessionUri` + Server SDK, or `factory` + `createBaseFlow` / `createRedirectFlow`                                                                                                                                                                                                                     |
| Hand-written BFF endpoints                                                              | `createBaseServerSDK` (`@strivacity/sdk-core/server`) or the wrapper's `createServerSDK` (`@strivacity/sdk-next/server`, `-angular/server`, `-svelte/server`, `-solid/server`, Nuxt module)                                                                                                                 |
| `LocalStorage`, `SessionStorage` classes                                                | `createLocalStorage()`, `createSessionStorage()` from `@strivacity/sdk-core/storages` (or the wrapper root)                                                                                                                                                                                                 |
| `DefaultLogging`, `HttpClient` classes                                                  | `createDefaultLogging()`, `createHttpClient()` from `@strivacity/sdk-core/utils` (or the wrapper root)                                                                                                                                                                                                      |
| `StyLoginRenderer`, `NativeFlowContext`, `StrivacityWidgetService`, `NativeFlowHandler` | `useNativeLogin()` / `useNativeLoginContext()` (React, Preact, Next, Vue, Nuxt, Svelte), `StrivacityNativeLoginService` (Angular), or `sdk.startSession()` / `submitForm()` / `finalizeSession()`                                                                                                           |
| `createCredential`, `getCredential`                                                     | `createWebAuthnCredential`, `assertWebAuthnCredential`                                                                                                                                                                                                                                                      |

## Common upgrade mistakes

| Mistake                                                                                                                  | Symptom                                                                                                                                                                                             | Fix                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install @strivacity/sdk-react` without `@next`                                                                      | Still on 3.x, v4 code does not compile                                                                                                                                                              | `@next` or an exact `4.x` version                                                                                                      |
| Upgrading the wrapper but leaving `@strivacity/sdk-core@3` in `package.json`                                             | Duplicate core, type errors such as "two different types with this name"                                                                                                                            | Remove the direct core dependency, or bump it to the same 4.x version                                                                  |
| `mode` left out                                                                                                          | `UnsupportedFlowError: Unsupported flow mode`                                                                                                                                                       | Add `mode: 'redirect'` (the old default)                                                                                               |
| `storage: LocalStorage` kept                                                                                             | Type error, or `storage.get is not a function`                                                                                                                                                      | `storage: createLocalStorage()`                                                                                                        |
| Custom `httpClient` with only `request()`                                                                                | Token requests fail                                                                                                                                                                                 | Also implement `sendTokenRequest(url, data)`                                                                                           |
| Native `handler.startSession(sessionId)` kept                                                                            | The session id is ignored and a new session starts                                                                                                                                                  | `sdk.startSession({ sessionId })` or the wrapper's `useNativeLogin({ params: { sessionId } })`                                         |
| Nuxt upgraded without `serverSessionUri: null` or `cookieSecret`                                                         | Server log `Failed to initialize the Strivacity server SDK: ConfigurationError: Missing SDK option: cookieSecret` and `500 Strivacity SDK failed to initialize`, or login now goes to `/auth/login` | Choose: `serverSessionUri: null` (v3 behaviour), or set a server-only `cookieSecret`                                                   |
| Next / Svelte imports from the package root                                                                              | Module not found                                                                                                                                                                                    | `@strivacity/sdk-next/client` / `/server`, `@strivacity/sdk-svelte/client` / `/server`                                                 |
| Angular `.subscribe()` on `login()` / `isAuthenticated()`                                                                | `subscribe is not a function`                                                                                                                                                                       | `await auth.login()`. Read `auth.isAuthenticated()` as a signal                                                                        |
| Core `initFlow({...})` without a type argument                                                                           | `'sdk' is of type 'unknown'`                                                                                                                                                                        | `initFlow<RedirectFlow>({...})`                                                                                                        |
| Reading sync getters (`sdk.accessToken`, `sdk.isAuthenticatedSync`, `sdk.session`) right after `initFlow()` in core code | Empty or `false` for a signed-in user                                                                                                                                                               | `await sdk.init()` (v3's `waitToInitialize()`) or `await sdk.checkAuthentication()` first. The async methods await `init()` themselves |
| Nuxt: `login()` or another SDK method called during SSR                                                                  | `[@strivacity/sdk-nuxt] login() is only available in the browser. During SSR, useStrivacity() is read-only.`                                                                                        | Call it from `onMounted()` or an event handler                                                                                         |
| Subscribing to events on one flow instance and expecting them from another                                               | Callbacks never fire                                                                                                                                                                                | Events are per instance in v4. Share one SDK instance                                                                                  |
| Deploying while users are mid-login                                                                                      | `State not found` on the callback right after the deploy                                                                                                                                            | Expected once: PKCE state moved to `stateStorage`. Users retry the login                                                               |
| Switching to server-managed sessions in the same change                                                                  | Hard to tell which change broke login                                                                                                                                                               | Reach v4 parity first, then add `serverSessionUri` and the Server SDK                                                                  |

Further reading: the "Migration guide" section of each package README at https://github.com/Strivacity/sdk-js/tree/main/packages and https://docs.strivacity.com/reference/javascript-sdks
