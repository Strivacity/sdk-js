<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte';

	const { state, revoke } = useStrivacity();

	onMount(async () => {
		if (!browser) {
			return;
		}

		if (state.isAuthenticated) {
			await revoke();
		}

		await goto(resolve('/'));
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
