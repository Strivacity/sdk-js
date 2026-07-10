<script lang="ts">
	import '@strivacity/common/components/token-field';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	async function handleRefresh() {
		// This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSessionUri` setting.
		if (ctx.sdk.options.serverSessionUri) {
			globalThis.location.href = '/auth/refresh?returnTo=/profile';
		} else {
			try {
				await ctx.refresh();
			} catch (error) {
				await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			}
		}
	}
</script>

<section>
	<sty-app-token-field type="id_token" value={ctx.sdk.session?.id_token ?? null}></sty-app-token-field>
	<sty-app-token-field type="access_token" value={ctx.accessToken} expiresAt={ctx.sdk.session?.expires_at ?? null}></sty-app-token-field>
	<sty-app-token-field type="refresh_token" value={ctx.refreshToken} onrefreshToken={handleRefresh}></sty-app-token-field>
</section>
