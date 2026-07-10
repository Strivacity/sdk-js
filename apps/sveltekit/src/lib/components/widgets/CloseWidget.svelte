<script lang="ts">
	import type { CloseWidget } from '@strivacity/sdk-svelte/client';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: CloseWidget } = $props();

	const context = useNativeLoginContext();
	const disabled = $derived(context.loading);

	function onClose() {
		if (disabled) {
			return;
		}

		context.triggerClose();
	}
</script>

{#if config.render?.type === 'button'}
	<button
		disabled={disabled}
		style:background-color={config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? `#5d21ab` : `#ffffff`)}
		style:color={config.render.textColor ?? (config.render.hint?.variant === 'primary' ? `#ffffff` : `#5d21ab`)}
		data-widget="close"
		data-type="button"
		data-form-id={formId}
		data-widget-id={config.id}
		onclick={(e) => {
			e.preventDefault();
			onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				onClose();
			}
		}}
	>
		{config.label}
	</button>
{:else}
	<!-- svelte-ignore a11y_missing_attribute -->
	<a
		data-widget="close"
		data-type="link"
		data-form-id={formId}
		data-widget-id={config.id}
		tabindex="0"
		role="button"
		onclick={(e) => {
			e.preventDefault();
			onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				onClose();
			}
		}}
	>
		{config.label}
	</a>
{/if}
