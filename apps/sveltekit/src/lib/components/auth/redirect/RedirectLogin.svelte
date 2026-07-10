<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import { extraParams } from '../';

	let { flowType }: { flowType: 'login' | 'register' } = $props();

	const ctx = useStrivacity();

	onMount(() => {
		if (flowType === 'register') {
			void ctx.register(extraParams);
		} else {
			void ctx.login(extraParams);
		}
	});
</script>

<section>Loading...</section>
