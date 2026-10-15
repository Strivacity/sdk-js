<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useStrivacity } from '@strivacity/sdk-svelte/client';

	const ctx = useStrivacity();
	let started = false;

	// Wait until the SDK has restored the session: on a direct page load `isAuthenticated` is still `false` while `loading` is `true`.
	$effect(() => {
		if (ctx.loading || started) {
			return;
		}

		started = true;

		// This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSessionUri` setting.
		if (ctx.sdk.options.serverSessionUri) {
			globalThis.location.href = `/auth/logout${location.search}`;
		} else if (ctx.isAuthenticated) {
			void ctx.logout({ postLogoutRedirectUri: new URL('/', globalThis.location.origin).toString() });
		} else {
			void goto(resolve('/'));
		}
	});
</script>

<section>
	<h1>Logging out...</h1>
</section>
