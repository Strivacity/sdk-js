<script lang="ts">
	import { setContext } from 'svelte';
	import type { Component } from 'svelte';
	import { STRIVACITY_SDK } from '../../src/client/hooks.svelte';
	import type { SDKContext, RedirectFlow, PopupFlow, NativeFlow, EmbeddedFlow } from '../../src/types';

	type Flow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow;

	const {
		context,
		component: Child,
		componentProps = {},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: { context?: SDKContext<Flow>; component: Component<any, any>; componentProps?: Record<string, unknown> } = $props();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let instance: any;

	// setContext must run synchronously during this component's own initialization so the child
	// component instantiated below can read it via getContext during its own initialization.
	if (context) {
		setContext(STRIVACITY_SDK, context);
	}

	export function getInstance() {
		return instance;
	}
</script>

<Child {...componentProps} bind:this={instance} />
