<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte';

	const { state, logout } = useStrivacity();

	onMount(async () => {
		if (state.isAuthenticated) {
			await logout();
		} else {
			await goto(resolve('/'));
		}
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
