<script lang="ts">
	import type { NativeFlowContextValue, CloseWidget } from '@strivacity/sdk-svelte';
	import { getContext } from 'svelte';

	let { formId, config }: { formId: string; config: CloseWidget } = $props();

	const context = getContext<NativeFlowContextValue>('nativeFlowContext');
	const disabled = $derived(context.loading);

	function onClose() {
		if (disabled) {
			return;
		}

		context.triggerClose();
	}
</script>

{#if config.render.type === 'button'}
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

<style lang="scss">
	:global {
		[data-widget='close'] {
			cursor: pointer;
			outline-color: #5d21ab;

			&[data-type='button'] {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				margin-block: 1rem;
				min-height: 2.25rem;
				padding: 0.5rem 1rem;
				font-size: 1rem;
				box-shadow: rgb(0 0 0 / 5%) 0 1px 2px 0;
				border: 1px solid rgb(0 0 0 / 15%);
				border-radius: 4px;
				position: relative;

				&:disabled {
					cursor: not-allowed;
					background-color: #f5f5f5 !important;
					color: #bdbdbd !important;
					border-color: #e0e0e0;
					box-shadow: none;
				}
			}

			&[data-type='link'] {
				display: inline-block;
				text-align: center;
				color: #5d21ab;

				&:hover {
					color: oklch(from #5d21ab l calc(l * 0.85) c h);
				}
			}

			+ [data-widget='close'] {
				margin-top: 1rem;
			}
		}
	}
</style>
