<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		if (!browser) {
			return;
		}

		// NOTE: This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSideSession` setting.
		if (ctx.sdk.options.serverSideSession) {
			globalThis.location.href = `/auth/callback${location.search}`;
		} else {
			const url = new URL(location.href);

			if (url.searchParams.has('session_id')) {
				await goto(`${resolve('/login')}?${url.searchParams}`);
			} else {
				try {
					await ctx.handleCallback();
					await goto(resolve('/profile'));
				} catch (error) {
					// eslint-disable-next-line no-console
					console.error('Error during callback handling:', error);
				}
			}
		}
	});
</script>

{#if page.url.searchParams.has('error')}
	<section>
		<h1>Error in authentication</h1>
		<div>
			<h4>{page.url.searchParams.get('error')}</h4>
			<p>{page.url.searchParams.get('error_description')}</p>
		</div>
	</section>
{:else}
	<section>
		<h1>Logging in...</h1>
	</section>
{/if}
