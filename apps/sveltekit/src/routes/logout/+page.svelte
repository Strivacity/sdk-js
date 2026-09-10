<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();

	onMount(async () => {
		// This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSessionUri` setting.
		if (ctx.sdk.options.serverSessionUri) {
			globalThis.location.href = `/auth/logout${location.search}`;
		} else {
			if (ctx.isAuthenticated) {
				await ctx.logout();
			} else {
				await goto(resolve('/'));
			}
		}
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
