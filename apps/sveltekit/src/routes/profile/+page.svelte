<script lang="ts">
	import '@strivacity/common/components/token-field';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { PageProps } from './$types';
	import { sdkOptions } from '$lib/options';

	let { data }: PageProps = $props();
	const ctx = useStrivacity();

	// This demo shows both session modes side by side.
	// Server-managed: the full session comes from this page's demo-only server `load()` (layout data has no ID/refresh token).
	// Client-managed: `ctx.sdk.session` is a plain property, not `$state`, so re-read it whenever the reactive `ctx.accessToken` changes.
	const session = $derived.by(() => {
		if (sdkOptions.serverSessionUri) {
			return data.session;
		}

		void ctx.accessToken;

		return ctx.sdk?.session ?? null;
	});

	async function handleRefresh() {
		// Server-managed sessions: refresh() navigates to the server's refresh route (`${authUriPrefix}/refresh`), which comes back to /profile
		try {
			await ctx.refresh({ returnTo: '/profile' });
		} catch (error) {
			await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	}
</script>

<section>
	<sty-app-token-field type="id_token" value={session?.id_token ?? null}></sty-app-token-field>
	<sty-app-token-field type="access_token" value={session?.access_token ?? null} expiresAt={session?.expires_at ?? null}></sty-app-token-field>
	<sty-app-token-field type="refresh_token" value={session?.refresh_token ?? null} onrefreshToken={handleRefresh}></sty-app-token-field>
</section>
