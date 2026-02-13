<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte';

	const { entry } = useStrivacity();

	onMount(async () => {
		if (!browser) {
			return;
		}

		try {
			const data = await entry();

			if (data && Object.keys(data).length > 0) {
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(`${resolve('/login')}?${new URLSearchParams(data).toString()}`);
			} else {
				await goto(resolve('/'));
			}
		} catch (error) {
			alert(error)
			await goto(resolve('/'));
		}
	});
</script>

<section>
	<h1>Redirecting...</h1>
</section>
