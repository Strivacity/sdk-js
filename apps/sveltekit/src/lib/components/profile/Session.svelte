<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import { DateTime } from 'luxon';

	const ctx = useStrivacity();

	async function handleRefresh() {
		// NOTE: This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSideSession` setting.
		if (ctx.sdk.options.serverSideSession) {
			globalThis.location.href = '/auth/refresh?returnTo=/profile';
		} else {
			try {
				await ctx.refresh();
			} catch (error) {
				await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`)
			}
		}
	}
</script>

<section>
{#if !ctx.loading}
	<h2>Session</h2>
	<dl>
		<dt>expires</dt>
		<dd>{ctx.sdk.session?.expires_at ? DateTime.fromMillis(ctx.sdk.session.expires_at * 1000).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS) : '-'}</dd>

		<dt>access token</dt>
		<dd>{ctx.accessToken}</dd>

		<dt>refresh token</dt>
		<dd>{ctx.refreshToken}</dd>

		{#if ctx.sdk.session?.refresh_token}
			<dt></dt>
			<dd><button onclick={handleRefresh}>Refresh</button></dd>
		{/if}

		<dt>account id</dt>
		<dd>{ctx.sdk.session?.claims?.sub ?? '-'}</dd>

		<dt>claims</dt>
		<dd>
			<pre>{JSON.stringify(ctx.idTokenClaims, null, 2)}</pre>
		</dd>
	</dl>
{/if}
</section>
