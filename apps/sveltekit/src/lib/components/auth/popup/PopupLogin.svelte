<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import { extraParams } from '../';

	let { flowType }: { flowType: 'login' | 'register' } = $props();

	const ctx = useStrivacity();

	onMount(async () => {
		try {
			if (flowType === 'register') {
				await ctx.register(extraParams);
			} else {
				await ctx.login(extraParams);
			}

			globalThis.location.href = '/profile';
		} catch (error) {
			globalThis.location.href = `${resolve('/error')}?error_description=${encodeURIComponent(error.message)}`;
		}
	});
</script>

<section>Loading...</section>
