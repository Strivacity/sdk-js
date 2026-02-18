<script lang="ts">
	import { StyAuthProvider, DefaultLogging, type SDKOptions } from '@strivacity/sdk-svelte';
	import LayoutContent from './LayoutContent.svelte';

	void import(/* @vite-ignore */`${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);

	let { children } = $props();

	const options: SDKOptions = {
		mode: import.meta.env.VITE_MODE,
		issuer: import.meta.env.VITE_ISSUER,
		scopes: import.meta.env.VITE_SCOPES?.split(' ') ?? [],
		clientId: import.meta.env.VITE_CLIENT_ID,
		redirectUri: import.meta.env.VITE_REDIRECT_URI,
		storageTokenName: 'sty.session.svelte-kit',
		logging: DefaultLogging,
	};
</script>

<StyAuthProvider {options}>
	<LayoutContent>
		{@render children()}
	</LayoutContent>
</StyAuthProvider>
