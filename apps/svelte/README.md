# Strivacity SDK - Svelte Example App

This example application demonstrates how to integrate the [@strivacity/sdk-svelte](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-svelte) SDK into a SvelteKit application using Svelte 5. It covers all supported authentication modes (`redirect`, `popup`, `native`, `embedded`) and shows how to structure file-based route authentication flows.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

The SDK is initialized via `StyAuthProvider` in `src/routes/+layout.svelte`. The `useStrivacity` function provides reactive authentication state and methods in all route components using Svelte 5 runes. SvelteKit's built-in file-based router is used for client-side navigation.

## Requirements

- Svelte: 5+
- SvelteKit: 2+
- Node.js: 20 LTS+

## Install

```bash
pnpm install
```

Create a `.env.local` file in the repository root:

```env
VITE_MODE=redirect
VITE_ISSUER=your-cluster-domain
VITE_CLIENT_ID=your-client-id
VITE_SCOPES=openid profile email
VITE_REDIRECT_URI=http://localhost:4200/callback
```

Then start the development server:

```bash
pnpm app:svelte:serve
```

## Usage

### Initialization

The SDK is configured in `src/routes/+layout.svelte`. All environment variables are read from the Vite environment and passed directly. The layout also dynamically imports `bundle.js` from the configured issuer domain, which registers the Strivacity web components (`<sty-login>`, `<sty-notifications>`, `<sty-language-selector>`, etc.) used in `embedded` mode:

```svelte
<script lang="ts">
    import { StyAuthProvider, DefaultLogging, type SDKOptions } from '@strivacity/sdk-svelte';

    void import(`${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);

    const options: SDKOptions = {
        mode: import.meta.env.VITE_MODE,
        issuer: import.meta.env.VITE_ISSUER,
        scopes: import.meta.env.VITE_SCOPES.split(' '),
        clientId: import.meta.env.VITE_CLIENT_ID,
        redirectUri: import.meta.env.VITE_REDIRECT_URI,
        storageTokenName: 'sty.session.svelte-kit',
        logging: DefaultLogging,
    };

    let { children } = $props();
</script>

<StyAuthProvider {options}>
    {@render children()}
</StyAuthProvider>
```

Route components access authentication state by calling `useStrivacity()` at the component level using Svelte 5 runes:

```svelte
<script lang="ts">
    import { useStrivacity } from '@strivacity/sdk-svelte';
    import { derived } from "svelte/store";

    const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
</script>

{#if $loading}
    <p>Loading...</p>
{:else if $isAuthenticated}
    <p>Welcome, {$idTokenClaims?.given_name}!</p>
{/if}
```

### Login / Register

`src/routes/login/+page.svelte` and `src/routes/register/+page.svelte` initiate the authentication flow. The active mode determines how the UI is rendered:

- **`redirect`** — `login()` is called on mount; the user is taken to the identity provider in the same window.
- **`popup`** — `login()` is called on mount; authentication happens in a popup window.
- **`native`** — The `StyLoginRenderer` component renders the login UI inline using your custom widget components.
- **`embedded`** — The `<sty-login>` web component (loaded via `bundle.js` from the cluster) takes over rendering.

`src/routes/callback/+page.svelte` handles the response from the identity provider. It calls `sdk.handleCallback()` and navigates to `/profile` on success:

```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { useStrivacity } from '@strivacity/sdk-svelte';

    const { sdk } = useStrivacity();

    onMount(async () => {
        const url = new URL(location.href);
        if (url.searchParams.has('session_id')) {
            await goto(resolve(`/login?${url.searchParams}`));
        } else {
            try {
                await sdk.handleCallback();
                await goto(resolve("/profile"));
            } catch (error) {
                console.error('Error during callback handling:', error);
            }
        }
    });
</script>

<h1>Logging in...</h1>
```

### Refresh token

Token refresh runs automatically when the SDK detects an expired access token. The `refresh` method is also available via `useStrivacity()` for manual invocation:

```svelte
<script lang="ts">
    import { useStrivacity } from '@strivacity/sdk-svelte';

    const { refresh } = useStrivacity();
</script>

<button onclick={() => void refresh()}>Refresh token</button>
```

### Revoke session / logout

`src/routes/revoke/+page.svelte` revokes the current session tokens without a full logout. It checks `isAuthenticated` before calling `revoke()` and then returns to the home page:

```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { useStrivacity } from '@strivacity/sdk-svelte';

    const { isAuthenticated, revoke } = useStrivacity();

    onMount(async () => {
        if ($isAuthenticated) {
            await revoke();
        }
        await goto(resolve("/"));
    });
</script>
```

`src/routes/logout/+page.svelte` performs a full logout. When the user is authenticated, `logout()` is called; otherwise the user is immediately redirected home:

```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { useStrivacity } from '@strivacity/sdk-svelte';

    const { isAuthenticated, logout } = useStrivacity();

    onMount(async () => {
        if ($isAuthenticated) {
            await logout();
        } else {
            await goto(resolve("/"));
        }
    });
</script>
```

### Resume an externally-initiated flow

`src/routes/entry/+page.svelte` handles flows started by an external process (e.g. password reset, magic link, invite). On mount it calls `entry()`, which processes the incoming URL and returns a `session_id` (and optionally a `short_app_id`). These are forwarded as query parameters to `/callback` to resume the flow; if no data is returned the user is redirected to the home page:

```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { useStrivacity } from '@strivacity/sdk-svelte';

    const { entry } = useStrivacity();

    onMount(async () => {
        try {
            const data = await entry();
            if (data && Object.keys(data).length > 0) {
                await goto(resolve(`/callback?${new URLSearchParams(data).toString()}`));
            } else {
                await goto(resolve("/"));
            }
        } catch (error) {
            alert(error);
            await goto(resolve("/"));
        }
    });
</script>
```

The callback page detects the `session_id` parameter and forwards it to `/login` to continue the native or embedded flow, instead of running the standard `handleCallback()` path.

The login page extracts `session_id` and `short_app_id` from the URL on load, cleans up the URL, and passes them to the renderer. When a `session_id` is present the renderer calls `startSession(sessionId)` to resume the existing flow instead of starting a new login.

You can also navigate directly to `/login?session_id=<id>` to resume a flow without going through the entry page, which is useful when the `session_id` is obtained through your own backend logic.

## Logging

Enable the built-in console logger by passing `logging: DefaultLogging` to the SDK options:

```typescript
import { DefaultLogging } from '@strivacity/sdk-svelte';

// ...within your SDK options:
logging: DefaultLogging,
```

The default logger writes to the browser console and prefixes messages with the `xEventId` correlation ID when available.

To use a custom logger, implement the `SDKLogging` interface and register your class in the SDK options:

```typescript
import type { SDKLogging } from '@strivacity/sdk-svelte';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		console.debug(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	info(message: string): void {
		console.info(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	warn(message: string): void {
		console.warn(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	error(message: string, error: Error): void {
		console.error(this.xEventId ? `(${this.xEventId}) ${message}` : message, error);
	}
}
```

```typescript
import { MyLogger } from './logging/MyLogger';

// ...within your SDK options:
logging: MyLogger,
```

## Pages

| Page     | Path                               | Description                                                                                                                                                        |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home     | `src/routes/+page.svelte`          | Public landing page. Displays user info when authenticated.                                                                                                        |
| Login    | `src/routes/login/+page.svelte`    | Entry point for the authentication flow. Accepts optional `session_id` and `short_app_id` URL parameters to resume an existing flow instead of starting a new one. |
| Register | `src/routes/register/+page.svelte` | Entry point for the registration flow. Mirrors the login page structure with an extra `prompt: create` parameter passed to the authentication request.             |
| Callback | `src/routes/callback/+page.svelte` | Handles the identity provider's redirect response. Routes to the login page when a `session_id` is present, otherwise completes the standard authorization flow.   |
| Entry    | `src/routes/entry/+page.svelte`    | Entry point for externally-initiated flows (e.g. password reset). Processes the incoming URL and routes to the appropriate next step.                              |
| Profile  | `src/routes/profile/+page.svelte`  | Protected page showing the authenticated user's session details and token information.                                                                             |
| Revoke   | `src/routes/revoke/+page.svelte`   | Invalidates the current session tokens without a full logout and returns the user to the home page.                                                                |
| Logout   | `src/routes/logout/+page.svelte`   | Terminates the user's session and redirects to the home page after logout.                                                                                         |

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This example app is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
