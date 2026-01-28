<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { useStrivacity } from '@strivacity/sdk-svelte';

	const { handleCallback } = useStrivacity();

	onMount(async () => {
		if (!browser) {
			return;
		}

		const url = new URL(location.href);
		const sessionId = url.searchParams.get('session_id');

		if (sessionId) {
			await goto(resolve(`/login?session_id=${sessionId}`));
		} else {
			try {
				await handleCallback();
				await goto(resolve('/profile'));
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error('Error during callback handling:', error);
			}
		}
	});
</script>

{#if $page.url.searchParams.has('error')}
	<section>
		<h1>Error in authentication</h1>
		<div>
			<h4>{$page.url.searchParams.get('error')}</h4>
			<p>{$page.url.searchParams.get('error_description')}</p>
		</div>
	</section>
{:else}
	<section>
		<h1>Logging in...</h1>
	</section>
{/if}
