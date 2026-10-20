# Popup mode (`mode: 'popup'`)

The Strivacity-hosted login page opens in a pop-up window (or a new tab). The app page stays where it is. When the user finishes, the pop-up lands on your `redirectUri` (the **callback page**), posts the authorization response back to the opener with `postMessage`, and the opener exchanges the code for tokens. `login()` resolves in the opener when this is done.

**Choose it when:** the hosted login UI is acceptable but the app must not navigate away (unsaved state, single-page dashboards, "log in to continue" dialogs).

**Choose another mode if:** pop-up blockers or mobile browsers are a concern (use `redirect`), the login UI must render inside your page (use `embedded`), or you need fully custom login screens (use `native`).

Hosted journey docs: https://docs.strivacity.com/reference/hosted-journey

## Admin Console requirement

- Client type: **OIDC using no-code components** (same as `redirect`). A Journey Flow API client does not work with `popup`.
- Register the exact `redirectUri` (for example `https://app.example.com/callback`) as an allowed redirect URI. The pop-up navigates there.
- Register every `postLogoutRedirectUri` you pass to `logout()`.
- No Entry URL is needed for this mode.

## How the flow works

1. The app calls `login()` / `register()`. The SDK adds `display=popup` to the authorization request automatically.
2. The default `uriHandler` (`popupUriHandler`) opens a centered window, points it at the authorization URL and waits for a `message` event from that window.
3. The IdP redirects the pop-up to `redirectUri`. Your callback page calls `handleCallback()`. In popup mode the default `callbackHandler` (`popupCallbackHandler`) does **not** exchange tokens. It posts the query (or fragment) parameters to `window.opener` and then stays pending forever. The opener closes the pop-up.
4. The opener receives the message, closes the pop-up and, for client-managed sessions, calls `tokenExchange()`. Then `login()` resolves.
5. Server-managed session (`serverSessionUri` set): the pop-up goes through your server login endpoint. Your callback page forwards to the server callback endpoint. Because the login started with `display=popup`, the Server SDK responds with a small HTML page that posts `{}` to the opener and closes itself. `login()` resolves, but the client SDK holds no tokens, so navigate or reload to read the server session. `refresh()` does not open a pop-up: it is a full-page navigation to the server refresh route in every mode.

## `login()` / `register()` params

`PopupParams` = `ExtraRequestArgs` (`loginHint`, `acrValues`, `uiLocales`, `audiences`, `prompt`) plus:

| Param                 | Type                  | Default (from `popupUriHandler`)                                                                                                     | Notes                                                                                                                                                                                                                                                         |
| :-------------------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `popupWindowFeatures` | `PopupWindowFeatures` | `{ location: false, toolbar: false, height: 640 }`; `width` is the first of 800/720/600/480 that fits `outerWidth / 1.618`, else 360 | Keys: `width`, `height`, `left`, `top`, `menubar`, `toolbar`, `location`, `status`, `resizable`, `scrollbars` (booleans become `yes`/`no`). `left` is always recalculated to center the window, and `top` is too whenever `height` is set (it is by default). |
| `popupWindowTarget`   | `string`              | `'_blank'`                                                                                                                           | Window name passed to `window.open`.                                                                                                                                                                                                                          |
| `checkOrigin`         | `boolean`             | not set (no origin check)                                                                                                            | When `true`, only messages whose `event.origin` equals the app's origin are accepted. The callback page is on your own origin, so set `checkOrigin: true`.                                                                                                    |

`register()` is `login()` with `prompt: 'create'`.

```ts
await login({
	popupWindowFeatures: { width: 500, height: 700 },
	checkOrigin: true,
});
```

Only one pop-up exists at a time. Calling `login()` again closes the previous pop-up first.

### Errors thrown by `login()`

| Error               | Message                | When                                                    |
| :------------------ | :--------------------- | :------------------------------------------------------ |
| `PopupBlockedError` | `Popup window blocked` | `window.open` returned `null` (blocked by the browser). |
| `PopupClosedError`  | `Popup closed by user` | The user closed the pop-up before finishing.            |

Both are exported from the framework package (for example `import { PopupBlockedError, PopupClosedError } from '@strivacity/sdk-react'`), and also from `@strivacity/sdk-core/utils/errors`. OIDC errors returned to the callback (`error=...`) reject `login()` with an `OidcError`.

### User gesture

Browsers allow `window.open` only shortly after a user interaction. Call `login()` from a click handler and handle `PopupBlockedError` (for example, show a "Open login window" button or fall back to `redirect`). The example apps start the pop-up on page mount for demo purposes, which can be blocked in production.

## Logout

`logout({ postLogoutRedirectUri })` does **not** use a pop-up. It clears the local session and then navigates the current window to the IdP end-session endpoint, exactly like redirect mode. The popup flow always uses the redirect handler for this, even when you pass a custom `uriHandler`. The IdP then sends the browser back to `postLogoutRedirectUri`, so code after `await logout()` does not get to do anything useful. Without an ID token in the session, `logout()` only clears the local session and does not navigate.

```ts
await logout({ postLogoutRedirectUri: window.location.origin });
```

With `serverSessionUri` set, navigate to the server logout route (for example `/auth/logout`) instead of calling `logout()`.

## Required routes

| Route                      | Purpose                                                                                                          |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| A page with a login button | Calls `login()` / `register()` and navigates once it resolves.                                                   |
| Callback (= `redirectUri`) | Loaded **inside the pop-up**. Required in popup mode, because without it nothing posts the result to the opener. |

### What the callback page must do

The same page and logic as in redirect mode work unchanged:

- Client-managed session: call `handleCallback()`. In popup mode it never resolves (the pop-up gets closed by the opener), so do not rely on code after it running in the pop-up.
- Server-managed session: forward the full query string to the server callback endpoint (for example `/auth/callback?${searchParams}`), and do not call `handleCallback()`.
- Do not redirect the pop-up anywhere (not even to an error page for `?error=...`) before `handleCallback()` runs, or the opener never gets the result and the flow hangs until the user closes the window (`PopupClosedError`).

## Framework snippets

The callback page uses the same logic as in redirect mode. Only the login trigger differs.

### Callback page (all frameworks)

```tsx
// React: route at the redirectUri path. Next.js: put the same component in a 'use client' file
// (import from '@strivacity/sdk-next/client'); with serverSessionUri set, use an app/callback/route.ts
// route handler instead that redirects to /auth/callback with the same query string.
import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-react';

export default function Callback() {
	const { sdk, loading, handleCallback } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		const searchParams = new URLSearchParams(window.location.search);

		if (sdk.options.serverSessionUri) {
			window.location.href = `/auth/callback?${searchParams.toString()}`;
		} else {
			// In the pop-up this posts the response to the opener and never resolves
			void handleCallback();
		}
	}, [loading]);

	return <p>Logging in...</p>;
}
```

```vue
<!-- Vue: Callback.vue at the redirectUri path -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useStrivacity } from '@strivacity/sdk-vue';

const { sdk, handleCallback } = useStrivacity();

onMounted(async () => {
	const searchParams = new URLSearchParams(window.location.search);

	if (sdk.options.serverSessionUri) {
		window.location.href = `/auth/callback?${searchParams.toString()}`;
	} else {
		await handleCallback();
	}
});
</script>

<template>
	<section>Logging in...</section>
</template>
```

Do not route `?error=...` responses to an error page inside the pop-up. Call `handleCallback()` for them too: it posts the error to the opener, where `login()` rejects with an `OidcError`. A redirect-mode callback that navigates to `/error` on error params leaves the opener waiting until the user closes the pop-up.

### React (`@strivacity/sdk-react`)

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { PopupFlow } from '@strivacity/sdk-react';
import { PopupBlockedError, PopupClosedError, useStrivacity } from '@strivacity/sdk-react';

export default function PopupLoginButton() {
	const { loading, login } = useStrivacity<PopupFlow>();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);

	const onClick = async () => {
		try {
			await login({ checkOrigin: true, popupWindowFeatures: { width: 500, height: 700 } });
			// Use a full reload instead if serverSessionUri is set, so the server session is read
			await navigate('/profile');
		} catch (e) {
			if (e instanceof PopupBlockedError) setError('Please allow pop-ups for this site.');
			else if (e instanceof PopupClosedError) setError('Login window was closed.');
			else setError((e as Error).message);
		}
	};

	return (
		<>
			<button disabled={loading} onClick={onClick}>
				Log in
			</button>
			{error && <p role="alert">{error}</p>}
		</>
	);
}
```

### Next.js (`@strivacity/sdk-next`, App Router)

```tsx
// components/auth/PopupLoginButton.tsx
'use client';

import type { PopupFlow } from '@strivacity/sdk-next/client';
import { PopupBlockedError, useStrivacity } from '@strivacity/sdk-next/client';

export default function PopupLoginButton() {
	const { loading, login } = useStrivacity<PopupFlow>();

	const onClick = async () => {
		try {
			await login({ checkOrigin: true });
			// Next.js apps default to server-managed sessions: do a full navigation so the server reads the new session cookie
			window.location.href = '/profile';
		} catch (error) {
			const message = error instanceof PopupBlockedError ? 'Please allow pop-ups for this site.' : (error as Error).message;
			window.location.href = `/error?error_description=${encodeURIComponent(message)}`;
		}
	};

	return (
		<button disabled={loading} onClick={onClick}>
			Log in
		</button>
	);
}
```

The `app/callback/page.tsx` server component from redirect mode is reused as is. With `serverSessionUri` set it redirects to `/auth/callback`, and the `app/auth/[...strivacity]/route.ts` handler answers the pop-up with the close-and-notify page.

### Vue (`@strivacity/sdk-vue`)

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { PopupFlow } from '@strivacity/sdk-vue';
import { PopupBlockedError, PopupClosedError, useStrivacity } from '@strivacity/sdk-vue';

const { loading, login } = useStrivacity<PopupFlow>();
const router = useRouter();
const error = ref<string | null>(null);

async function onClick() {
	try {
		await login({ checkOrigin: true });
		await router.push('/profile');
	} catch (e) {
		if (e instanceof PopupBlockedError) error.value = 'Please allow pop-ups for this site.';
		else if (e instanceof PopupClosedError) error.value = 'Login window was closed.';
		else error.value = (e as Error).message;
	}
}
</script>

<template>
	<button :disabled="loading" @click="onClick">Log in</button>
	<p v-if="error" role="alert">{{ error }}</p>
</template>
```

## Common mistakes

| Symptom / mistake                                               | Cause                                                                                    | Fix                                                                                            |
| :-------------------------------------------------------------- | :--------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `PopupBlockedError: Popup window blocked`                       | `login()` not called from a user gesture (for example on mount or after a long `await`). | Trigger from a click handler. Catch the error and offer a retry button or a redirect fallback. |
| Pop-up shows your app (or a 404) and never closes; opener hangs | No callback route, or the callback page does not call `handleCallback()`.                | Add the callback page at `redirectUri` and call `handleCallback()` there.                      |
| Pop-up redirects inside itself to `/profile`                    | Callback page navigates before or instead of `handleCallback()`.                         | Let `handleCallback()` post the result; the opener navigates.                                  |
| `PopupClosedError: Popup closed by user`                        | User closed the window, or the callback page never posted a message.                     | Treat as cancel. If it happens on every login, check the callback page.                        |
| Logged in, but the client shows no tokens (BFF)                 | With `serverSessionUri` the tokens live on the server.                                   | After `login()` resolves, reload or navigate so the app reads the server session.              |
| Messages from other windows are accepted                        | `checkOrigin` not set (the handler checks the origin only when it is `true`).            | Pass `checkOrigin: true`.                                                                      |
| Custom `left` / `top` ignored                                   | `popupUriHandler` always recenters the window.                                           | Control size only (`width`, `height`), or provide your own `uriHandler`.                       |
| Confusing errors after switching `mode`                         | Client type is "OIDC using the Journey Flow API".                                        | Use an "OIDC using no-code components" client.                                                 |
| Redirect URI error in the pop-up                                | `redirectUri` not registered on the client.                                              | Register the exact URI.                                                                        |
