<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { ExtraRequestArgs } from '@strivacity/sdk-core';

	let { action, params }: { action: 'login' | 'register'; params: ExtraRequestArgs } = $props();

	const ctx = useStrivacity();

	onMount(() => {
		void (async () => {
			try {
				await ctx[action](params);
				await goto(resolve('/profile'));
			} catch (error) {
				await goto(`${resolve('/error')}?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			}
		})();
	});
</script>

<h1>Loading...</h1>
