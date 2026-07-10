<script lang="ts">
	import type { LayoutProps } from './$types';
	import { createStyAuthProvider, createDefaultLogging } from '@strivacity/sdk-svelte/client';
	import { sdkOptions } from '$lib/options';
	import LayoutContent from './LayoutContent.svelte';

	let { data, children }: LayoutProps = $props();

	createStyAuthProvider({
		options: { ...sdkOptions, logging: createDefaultLogging() },
		session: () => data.session,
	});
</script>

<LayoutContent>
	{@render children()}
</LayoutContent>

