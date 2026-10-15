# Embedded mode (`mode: 'embedded'`)

The Strivacity login UI is rendered inline on your own page by the `<sty-login>` web component. The user never leaves the page. The component bundle is served by your Strivacity cluster (it is **not** an npm package). The SDK, initialized with `mode: 'embedded'`, provides the OIDC/PKCE plumbing that the component uses.

**Choose it when:** the login form must sit inside your own layout (a modal, a side panel, a branded landing page) but you do not want to build and maintain the login screens yourself. Branding and journey changes made in the Admin Console show up automatically.

**Choose another mode if:** a full-page hosted login is fine (use `redirect`, the simplest option), you need to own every pixel and every screen (use `native`), or you cannot load a script from your Strivacity cluster domain (CSP restrictions; use `redirect`, `popup` or `native`).

Embedded journey docs: https://docs.strivacity.com/reference/embedded-journey

## Admin Console requirement

- Client type: **OIDC using the Journey Flow API**. A "no-code components" client does not work with `embedded`.
- Register `redirectUri` as an allowed redirect URI even though the user is not navigated there in client-managed mode. The SDK rejects a finalize response whose redirect does not start with `redirectUri` (`ProtocolError: Invalid redirect URI`).
- Set the client's **Entry URL** to your app's `/entry` route (for example `https://app.example.com/entry`). Externally-initiated flows (password-reset links, email verification) land there.
- For passkeys/WebAuthn, add your app origin to the trusted origins. See https://docs.strivacity.com/reference/sdks#client-configuration

## How it fits together

1. Initialize the SDK with `mode: 'embedded'` (through your framework's provider). On creation, the embedded flow publishes itself as `globalThis.sty.oidcService` (a read-only proxy). `<sty-login>` uses it to start and finalize the session.
2. Load the component bundle once: `injectScript('sty-components', 'https://<your-cluster-domain>/assets/components/bundle.js')`. `injectScript` comes from the framework package (re-exported from `@strivacity/sdk-core/utils`). It appends a `type="module"` script and is deduplicated by `id`.
3. Render `<sty-login>` (plus optional `<sty-notifications>` and `<sty-language-selector>`). It starts the flow when it connects to the DOM, unless it has the `lazy` attribute.
4. When the journey completes, the SDK finalizes the session:
   - Client-managed session: the code is exchanged in the browser, tokens are stored and `<sty-login>` dispatches `login`.
   - Server-managed session (`serverSessionUri` set): the SDK sets `window.location.href` to `redirectUri?code=...`. Your callback page must forward that to the server callback endpoint (see Required routes).

The SDK methods behind this are `startSession(params?)`, `finalizeSession(url)` and `entry(url?)`. The component calls the first two; you normally call only `entry()`. `login()` / `register()` on the embedded flow are deprecated.

## `<sty-login>` API (`LoginComponent`)

Set these as **DOM properties** (not string attributes), before the flow starts:

| Property         | Type                     | Purpose                                                                                                                     |
| :--------------- | :----------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `params`         | `EmbeddedParams`         | Authorization params: `loginHint`, `acrValues`, `uiLocales`, `audiences`, `prompt` (`'create'` = registration), `language`. |
| `sessionId`      | `string \| null`         | Resume a session from the entry flow (`session_id`).                                                                        |
| `shortAppId`     | `string \| null`         | Resume a session from the entry flow (`short_app_id`).                                                                      |
| `lang`           | `string`                 | UI language (BCP 47). Changing it later switches language.                                                                  |
| `lazy`           | `boolean` (attribute OK) | Do not auto-start; call `start(params?)` yourself.                                                                          |
| `debug`          | `boolean`                | Component debug output.                                                                                                     |
| `start(params?)` | method                   | Starts the flow (use with `lazy`).                                                                                          |

`issuer`, `clientId` and `redirectUri` are **not** set on the element. They come from the SDK configuration.

Events dispatched on `<sty-login>`:

| Event   | `detail` | Meaning / typical handling                                  |
| :------ | :------- | :---------------------------------------------------------- |
| `login` | none     | Authentication completed. Navigate to the protected page.   |
| `close` | none     | The journey ended with a close action. For example, reload. |
| `error` | `string` | The flow cannot continue. Show or route to an error page.   |

`<sty-notifications>` renders the `notification` events that the components dispatch on `document` (`event.detail.action` is `'show'` with `event.detail.notification`, or `'clear'`). Omit it and listen on `document` yourself if you want your own toasts.

## Required routes

| Route                      | Required?                          | What it does                                                                                                                                                                  |
| :------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login / Register           | yes                                | Renders `<sty-login>`. Register = same component with `params.prompt = 'create'`. Reads `session_id`, `short_app_id`, `language` from the query string to resume entry flows. |
| Entry (`/entry`)           | yes (for reset/verification links) | Calls `entry()`, which returns `{ session_id, short_app_id, language }`, and redirects to `/login?session_id=...&short_app_id=...&language=...`.                              |
| Callback (= `redirectUri`) | server-managed sessions only       | Forwards the query string to the server callback (for example `/auth/callback?${searchParams}`). With client-managed sessions it is never navigated to.                       |

## Framework snippets

### React (`@strivacity/sdk-react`)

The JSX types for `sty-login`, `sty-notifications`, `sty-language-selector` and `sty-landing` come with the package's types. Set properties and listen to events through a ref:

```tsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import type { LoginComponent } from '@strivacity/sdk-react';
import { injectScript } from '@strivacity/sdk-react';

export default function EmbeddedLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const navigate = useNavigate();
	const loginRef = useRef<LoginComponent>(null);
	const searchParams = new URLSearchParams(window.location.search);
	const sessionId = searchParams.get('session_id');
	const shortAppId = searchParams.get('short_app_id');
	const language = searchParams.get('language') ?? navigator.language;

	useEffect(() => {
		injectScript('sty-components', 'https://<your-cluster-domain>/assets/components/bundle.js');
	}, []);

	useEffect(() => {
		const element = loginRef.current;

		if (!element) {
			return;
		}

		element.params = flowType === 'register' ? { prompt: 'create' } : {};
		element.sessionId = sessionId;
		element.shortAppId = shortAppId;
		element.lang = language;

		const onLogin = () => void navigate('/profile');
		const onClose = () => window.location.reload();
		const onError = (event: Event) => void navigate(`/error?error=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('close', onClose);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('close', onClose);
			element.removeEventListener('error', onError);
		};
	}, [navigate, flowType, sessionId, shortAppId, language]);

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={loginRef}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

Entry page:

```tsx
import { useEffect } from 'react';
import type { EmbeddedFlow } from '@strivacity/sdk-react';
import { useStrivacity } from '@strivacity/sdk-react';

export default function Entry() {
	const { loading, entry } = useStrivacity<EmbeddedFlow>();

	useEffect(() => {
		if (loading) {
			return;
		}

		entry()
			.then((params) => {
				const url = new URL('/login', window.location.origin);
				url.search = new URLSearchParams(params).toString();
				window.location.href = url.toString();
			})
			.catch((error) => {
				window.location.href = `/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`;
			});
	}, [loading, entry]);

	return null;
}
```

### Next.js (`@strivacity/sdk-next`, App Router)

Same component as React, as a client component with imports from `@strivacity/sdk-next/client`. Because Next.js apps default to server-managed sessions, the `login` event may never fire. The SDK navigates to `redirectUri`, and the `app/callback/route.ts` route handler must redirect to `/auth/callback` with the same query string (see the framework reference).

```tsx
// components/auth/EmbeddedLogin.tsx
'use client';

import { useEffect, useRef } from 'react';
import type { LoginComponent } from '@strivacity/sdk-next/client';
import { injectScript } from '@strivacity/sdk-next/client';

export default function EmbeddedLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const loginRef = useRef<LoginComponent>(null);

	useEffect(() => {
		injectScript('sty-components', 'https://<your-cluster-domain>/assets/components/bundle.js');
	}, []);

	useEffect(() => {
		const element = loginRef.current;

		if (!element) {
			return;
		}

		const searchParams = new URLSearchParams(window.location.search);
		element.params = flowType === 'register' ? { prompt: 'create' } : {};
		element.sessionId = searchParams.get('session_id');
		element.shortAppId = searchParams.get('short_app_id');
		element.lang = searchParams.get('language') ?? navigator.language;

		const onLogin = () => (window.location.href = '/profile');
		const onClose = () => window.location.reload();
		const onError = (event: Event) => (window.location.href = `/error?error=${encodeURIComponent((event as CustomEvent<string>).detail)}`);

		element.addEventListener('login', onLogin);
		element.addEventListener('close', onClose);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('close', onClose);
			element.removeEventListener('error', onError);
		};
	}, [flowType]);

	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login ref={loginRef}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
```

`app/entry/page.tsx` is the React entry page above with `'use client'`, imports from `@strivacity/sdk-next/client` and `useRouter` from `next/navigation` for the error case.

### Vue (`@strivacity/sdk-vue`)

Tell the Vue compiler that `sty-*` tags are custom elements (Vite):

```ts
// vite.config.ts
import vue from '@vitejs/plugin-vue';

export default {
	plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('sty-') } } })],
};
```

```vue
<!-- EmbeddedLogin.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { injectScript } from '@strivacity/sdk-vue';

const props = defineProps<{ flowType: 'login' | 'register' }>();
const router = useRouter();
const searchParams = new URLSearchParams(window.location.search);
const params = computed(() => (props.flowType === 'register' ? { prompt: 'create' } : {}));
const sessionId = searchParams.get('session_id');
const shortAppId = searchParams.get('short_app_id');
const lang = searchParams.get('language') ?? navigator.language;

injectScript('sty-components', 'https://<your-cluster-domain>/assets/components/bundle.js');

async function onLogin() {
	await router.push('/profile');
}

function onClose() {
	window.location.reload();
}

async function onError(event: CustomEvent) {
	await router.push(`/error?error=${encodeURIComponent(event.detail)}`);
}
</script>

<template>
	<section>
		<sty-notifications></sty-notifications>
		<sty-login
			:params.prop="params"
			:sessionId="sessionId"
			:shortAppId="shortAppId"
			:lang="lang"
			@login="onLogin"
			@close="onClose"
			@error="onError"
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
```

Entry page (`Entry.vue`):

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { EmbeddedFlow } from '@strivacity/sdk-vue';
import { useStrivacity } from '@strivacity/sdk-vue';

const { entry } = useStrivacity<EmbeddedFlow>();
const router = useRouter();

onMounted(async () => {
	try {
		const params = await entry();
		const url = new URL('/login', window.location.origin);
		url.search = new URLSearchParams(params).toString();
		window.location.href = url.toString();
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template><section>Loading...</section></template>
```

## Common mistakes

| Symptom / mistake                                       | Cause                                                                                                          | Fix                                                                                                                                       |
| :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `<sty-login>` renders nothing                           | Bundle not loaded (`injectScript` missing, wrong cluster URL, or blocked by CSP).                              | Call `injectScript('sty-components', 'https://<your-cluster-domain>/assets/components/bundle.js')`; allow the domain in CSP `script-src`. |
| Component loads but cannot start                        | SDK not created with `mode: 'embedded'` before the element mounts, so `globalThis.sty.oidcService` is missing. | Wrap the page in the provider configured with `mode: 'embedded'`.                                                                         |
| Errors right after switching to `embedded`              | Client type is "OIDC using no-code components".                                                                | Use an "OIDC using the Journey Flow API" client.                                                                                          |
| Password-reset / verification links fail                | Entry URL not configured, or no `/entry` route calling `entry()`.                                              | Configure the Entry URL to `https://<your-app-domain>/entry` and add the entry page.                                                      |
| Entry redirect lands on login but starts a fresh flow   | `session_id` / `short_app_id` / `language` not passed to `<sty-login>`.                                        | Read them from the query string and set `sessionId`, `shortAppId`, `lang`.                                                                |
| `params` ignored (Vue)                                  | Bound as an attribute (string) instead of a property.                                                          | Use `:params.prop="params"`.                                                                                                              |
| Vue warns "Failed to resolve component: sty-login"      | Compiler treats `sty-*` as Vue components.                                                                     | Add `isCustomElement: (tag) => tag.startsWith('sty-')`.                                                                                   |
| `ProtocolError: Invalid redirect URI`                   | SDK `redirectUri` does not match the redirect configured on the client.                                        | Use the exact registered `redirectUri`.                                                                                                   |
| BFF: after login the browser shows a 404 on `/callback` | With `serverSessionUri` the SDK navigates to `redirectUri?code=...`.                                           | Add the callback page that forwards to `/auth/callback?${searchParams}`.                                                                  |
| Setting `element.language` does nothing / TS error      | `language` is not a `LoginComponent` property; the element property is `lang`.                                 | Use `element.lang = '...'` (or `params.language`).                                                                                        |
