# Redirect mode (`mode: 'redirect'`)

The current browser tab navigates to the Strivacity-hosted login page. After the user authenticates, the identity provider sends the browser back to your `redirectUri` (the **callback page**), which completes the flow.

**Choose it when:** you want the simplest, most robust integration, the hosted login UI is acceptable, and a full-page navigation away from the app is fine. It is the default `mode`.

**Choose another mode if:** the app must not navigate away (use `popup`), the login UI must sit inside your own page layout (use `embedded`), or you need to render every login step with your own components (use `native`).

Hosted journey docs: https://docs.strivacity.com/reference/hosted-journey

## Admin Console requirement

- Client type: **OIDC using no-code components**. A Journey Flow API client does not work with `redirect`.
- Add the exact `redirectUri` (for example `https://app.example.com/callback`) to the client's allowed redirect URIs.
- Add every `postLogoutRedirectUri` you pass to `logout()` to the allowed post-logout redirect URIs.
- No Entry URL is needed for this mode.

## SDK options

```ts
const options = {
	mode: 'redirect',
	issuer: 'https://<your-cluster-domain>',
	clientId: '<your-client-id>',
	redirectUri: 'https://<your-app-domain>/callback',
	scopes: ['openid', 'profile'],
	// Optional, redirect-relevant:
	// responseMode: 'query',       // 'query' (default) | 'fragment'
	// uriHandler: async (url, params) => { ... },   // default: redirectUriHandler
	// callbackHandler: async (url, responseMode) => { ... }, // default: redirectCallbackHandler
};
```

| Option            | Default                   | Notes                                                                                                                            |
| :---------------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------- |
| `responseMode`    | `'query'`                 | `'fragment'` makes the IdP return `code`/`state` in the URL hash; the default callback handler reads `hash` instead of `search`. |
| `uriHandler`      | `redirectUriHandler`      | Called with the authorization URL and the `login()` params. Override only for custom navigation (for example an in-app browser). |
| `callbackHandler` | `redirectCallbackHandler` | Parses the callback URL into a params object. It rejects on duplicate query parameters (`ProtocolError`).                        |

## `login()` / `register()` params

Both accept `RedirectParams` (`ExtraRequestArgs & RedirectOptions`). `register()` is `login()` with `prompt: 'create'`.

| Param            | Type                    | Default    | Meaning                                                                                         |
| :--------------- | :---------------------- | :--------- | :---------------------------------------------------------------------------------------------- |
| `locationMethod` | `'assign' \| 'replace'` | `'assign'` | `window.location.assign` (keeps history entry) or `replace`.                                    |
| `targetWindow`   | `'self' \| 'top'`       | `'self'`   | `'top'` navigates the top-level window (useful when the app runs in an iframe).                 |
| `loginHint`      | `string`                |            | Sent as `login_hint`.                                                                           |
| `acrValues`      | `string[]`              |            | Sent as space-separated `acr_values`.                                                           |
| `uiLocales`      | `string[]`              |            | Sent as `ui_locales`.                                                                           |
| `audiences`      | `string[]`              |            | Requested token audiences.                                                                      |
| `prompt`         | `string`                |            | For example `'login'` or `'create'`.                                                            |
| `returnTo`       | `string`                |            | Same-origin path to come back to. `handleCallback()` resolves to it. Throws for another origin. |

`login()` resolves once navigation has been triggered; code after it effectively never runs in the original page. Do not expect a session after `await login()`.

With `serverSessionUri` set (server-managed session / BFF), `login()` navigates to your server endpoint (for example `/auth/login`) instead of the IdP, and no PKCE state is stored in the browser. `returnTo` is forwarded as `?returnTo=`, and the Server SDK redirects there after its callback.

## Required routes

| Route                        | Purpose                                                                               |
| :--------------------------- | :------------------------------------------------------------------------------------ |
| Login (for example `/login`) | Calls `login()` (or `register()`); shows only a "Redirecting..." placeholder.         |
| Callback (= `redirectUri`)   | Completes the flow. Must exist and must match the Admin Console redirect URI exactly. |
| Error (recommended)          | Shows `error` / `error_description` from the query string.                            |

### What the callback page must do

1. If the query string contains `error` or `error_description`, show/route to an error page. You can skip `handleCallback()` for these. If you call it anyway, it removes the stored `sty.<state>` entry from `stateStorage` and rejects with an `OidcError` that carries `error` / `errorDescription`.
2. **Client-managed session** (no `serverSessionUri`): wait until the SDK is no longer `loading`, then call `handleCallback()`. It parses the URL, verifies `state`, exchanges the code with PKCE, validates the ID token and stores the session. It resolves to `{ returnTo }` (the value given to `login({ returnTo })`): navigate there, or to a default protected page.
3. **Server-managed session** (`serverSessionUri` set): do **not** call `handleCallback()`. Forward the browser, with the full query string, to your server's callback endpoint (for example `/auth/callback?${searchParams}`); the Server SDK exchanges the code, sets the session cookie and redirects to `postLoginRedirectUri` (or `returnTo`).

Call `handleCallback()` once per callback URL. Concurrent calls for the same `state` share one in-flight exchange, but the stored state is consumed, so a later repeat call (for example after a re-render or remount) fails with `ProtocolError: Invalid or missing state`.

## Framework snippets

### React (`@strivacity/sdk-react`)

```tsx
// Login page
import { useEffect } from 'react';
import type { RedirectFlow } from '@strivacity/sdk-react';
import { useStrivacity } from '@strivacity/sdk-react';

export default function RedirectLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const { loading, login, register } = useStrivacity<RedirectFlow>();

	useEffect(() => {
		if (loading) {
			return;
		}

		void (flowType === 'register' ? register() : login());
	}, [loading, flowType, login, register]);

	return <p>Redirecting...</p>;
}
```

```tsx
// Callback page (route path must match redirectUri)
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity } from '@strivacity/sdk-react';

export default function Callback() {
	const { sdk, loading, handleCallback } = useStrivacity();
	const navigate = useNavigate();
	const handled = useRef(false);

	useEffect(() => {
		if (loading || handled.current) {
			return;
		}

		handled.current = true;
		const searchParams = new URLSearchParams(window.location.search);

		if (searchParams.get('error') || searchParams.get('error_description')) {
			void navigate(`/error?${searchParams.toString()}`);
		} else if (sdk.options.serverSessionUri) {
			// Server-managed session: let the Server SDK finish the flow
			window.location.href = `/auth/callback?${searchParams.toString()}`;
		} else {
			handleCallback()
				.then(({ returnTo }) => navigate(returnTo ?? '/profile'))
				.catch((error) => navigate(`/error?message=${encodeURIComponent(error.message)}`));
		}
	}, [loading]);

	return <p>Logging in...</p>;
}
```

Keep only the branch that matches your `serverSessionUri` setting.

### Next.js (`@strivacity/sdk-next`, App Router)

With server-managed sessions (the Next.js default, `serverSessionUri: '/auth/login'`) there is no client login or callback code: `/login` and `/callback` are route handlers that forward the query string to `/auth/login` and `/auth/callback`, as shown in the Next.js framework reference. Use the components below only for client-managed sessions (`serverSessionUri: false`).

The login component is a client component, rendered by `app/login/page.tsx` (and by a register page with `flowType="register"`):

```tsx
// components/auth/RedirectLogin.tsx
'use client';

import { useEffect } from 'react';
import type { RedirectFlow } from '@strivacity/sdk-next/client';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function RedirectLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const { loading, login, register } = useStrivacity<RedirectFlow>();

	useEffect(() => {
		if (loading) {
			return;
		}

		void (flowType === 'register' ? register() : login());
	}, [loading, flowType, login, register]);

	return <p>Redirecting...</p>;
}
```

The callback page renders a client component that completes the flow in the browser:

```tsx
// app/callback/page.tsx
import CallbackClient from './client';

export default function CallbackPage() {
	return <CallbackClient />;
}
```

```tsx
// app/callback/client.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function CallbackClient() {
	const { loading, handleCallback } = useStrivacity();
	const router = useRouter();

	useEffect(() => {
		if (loading) {
			return;
		}

		const searchParams = new URLSearchParams(window.location.search);

		if (searchParams.get('error') || searchParams.get('error_description')) {
			router.replace(`/error?${searchParams.toString()}`);
			return;
		}

		handleCallback()
			.then(() => router.push('/profile'))
			.catch((error) => router.push(`/error?message=${encodeURIComponent(error.message)}`));
	}, [loading]);

	return <p>Logging in...</p>;
}
```

### Vue (`@strivacity/sdk-vue`)

```vue
<!-- RedirectLogin.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import type { RedirectFlow } from '@strivacity/sdk-vue';
import { useStrivacity } from '@strivacity/sdk-vue';

const props = defineProps<{ flowType: 'login' | 'register' }>();
const { login, register } = useStrivacity<RedirectFlow>();

onMounted(async () => {
	await (props.flowType === 'register' ? register() : login());
});
</script>

<template>
	<section>Redirecting...</section>
</template>
```

```vue
<!-- Callback.vue (route path must match redirectUri) -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const { sdk, handleCallback } = useStrivacity();
const router = useRouter();
const searchParams = new URLSearchParams(window.location.search);

onMounted(async () => {
	if (searchParams.get('error') || searchParams.get('error_description')) {
		return await router.replace(`/error?${searchParams.toString()}`);
	}

	if (sdk.options.serverSessionUri) {
		window.location.href = `/auth/callback?${searchParams.toString()}`;
		return;
	}

	try {
		await handleCallback();
		await router.push('/profile');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template>
	<section>Logging in...</section>
</template>
```

## Common mistakes

| Symptom / mistake                                         | Cause                                                                                                    | Fix                                                                                |
| :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| IdP shows a redirect URI error                            | `redirectUri` not registered, or differs (scheme, port, trailing slash).                                 | Register the exact `redirectUri` on the client.                                    |
| 404 after login                                           | No route at the `redirectUri` path.                                                                      | Add the callback page.                                                             |
| Logged in at the IdP but no session in the app            | Callback page never calls `handleCallback()` (client-managed session).                                   | Call `handleCallback()` once the SDK is not `loading`.                             |
| `ProtocolError: Invalid or missing state` on the callback | `handleCallback()` re-run after the state was consumed, or the login started in another browser/storage. | Guard with a ref/flag so it runs once; start and finish login in the same browser. |
| Callback succeeds in dev, fails with BFF                  | `handleCallback()` called while `serverSessionUri` is set.                                               | Forward to the server callback endpoint (for example `/auth/callback`) instead.    |
| Confusing errors right after switching `mode`             | Client type is "OIDC using the Journey Flow API".                                                        | Use a client of type "OIDC using no-code components".                              |
| `ProtocolError: Duplicate parameter in redirect callback` | The callback URL contains a repeated query parameter (often added by app routing).                       | Keep the callback URL exactly as returned by the IdP.                              |
| Code after `await login()` expected to see a session      | `login()` only starts navigation.                                                                        | Read the session on the callback / protected page instead.                         |
| Logout lands on the hosted "logged out" page              | `postLogoutRedirectUri` missing or not allowed on the client.                                            | Pass it to `logout()` and register it in the Admin Console.                        |
