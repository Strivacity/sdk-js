<script lang="ts">
	import type { StaticWidget } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: StaticWidget } = $props();
</script>

{#if config.render?.type === 'html'}
	<div data-widget="static" data-form-id={formId} data-widget-id={config.id}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html config.value}
	</div>
{:else}
	<div data-widget="static" data-form-id={formId} data-widget-id={config.id}>
		{config.value}
	</div>
{/if}
