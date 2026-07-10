<script lang="ts">
	import { onMount } from 'svelte';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import type { ExtraRequestArgs } from '@strivacity/sdk-core';

	let { action, params }: { action: 'login' | 'register'; params: ExtraRequestArgs } = $props();

	const ctx = useStrivacity();

	onMount(() => {
		void ctx[action](params);
	});
</script>

<h1>Redirecting...</h1>
