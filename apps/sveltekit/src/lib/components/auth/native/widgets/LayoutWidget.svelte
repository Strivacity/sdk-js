<script lang="ts">
	import type { LayoutWidget } from '@strivacity/sdk-svelte/client';
	import type { Snippet } from 'svelte';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, type, tag = 'div', children }: { formId: string; type: LayoutWidget['type']; tag?: string; children: Snippet } = $props();

	const context = useNativeLoginContext();
	const disabled = $derived(context.loading);

	async function onSubmit() {
		if (disabled) {
			return;
		}

		await context.submitForm(formId);
	}
</script>

<svelte:element
	this={tag}
	data-widget="layout"
	data-type={type}
	data-form-id={formId}
	onsubmit={(e) => {
		e.preventDefault();
		void onSubmit();
	}}
>
	{@render children()}
</svelte:element>
