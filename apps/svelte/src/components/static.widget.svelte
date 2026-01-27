<script lang="ts">
	import type { StaticWidget } from '@strivacity/sdk-svelte';

	let { formId, config }: { formId: string; config: StaticWidget } = $props();
</script>

{#if config.render.type === 'html'}
	<div data-widget="static" data-form-id={formId} data-widget-id={config.id}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html config.value}
	</div>
{:else}
	<div data-widget="static" data-form-id={formId} data-widget-id={config.id}>
		{config.value}
	</div>
{/if}

<style lang="scss">
	:global {
		[data-widget='static'] {
			text-align: center;

			p {
				margin: 0;
			}

			&[data-widget-id='section-title'] {
				font-size: 1.5rem;
				font-weight: 600;
			}

			&:not(:has(+ [data-widget='submit'])) {
				margin-block-end: 0.5rem;
			}
		}
	}
</style>
