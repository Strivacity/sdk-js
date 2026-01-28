<script lang="ts">
	import type { NativeFlowContextValue, SubmitWidget } from '@strivacity/sdk-svelte';
	import { getContext } from 'svelte';

	let { formId, config }: { formId: string; config: SubmitWidget } = $props();

	const context = getContext<NativeFlowContextValue>('nativeFlowContext');
	const disabled = $derived(context.loading);

	async function onSubmit(event: Event) {
		if (disabled) {
			return;
		}

		const form = (event.target as HTMLElement).closest('form');

		if (form?.dataset.formId === formId) {
			form.requestSubmit();
		} else {
			await context.submitForm(formId);
		}
	}
</script>

{#if config.render.type === 'button'}
	<button
		type="submit"
		disabled={disabled}
		style:background-color={config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? `#5d21ab` : `#ffffff`)}
		style:color={config.render.textColor ?? (config.render.hint?.variant === 'primary' ? `#ffffff` : `#5d21ab`)}
		data-widget="submit"
		data-type="button"
		data-form-id={formId}
		data-widget-id={config.id}
		onclick={(e) => {
			e.preventDefault();
			void onSubmit(e);
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				void onSubmit(e);
			}
		}}
	>
		{config.label}
	</button>
{:else}
	<!-- svelte-ignore a11y_missing_attribute -->
	<a
		data-widget="submit"
		data-type="link"
		data-form-id={formId}
		data-widget-id={config.id}
		tabindex="0"
		role="button"
		onclick={(e) => {
			e.preventDefault();
			void onSubmit(e);
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				void onSubmit(e);
			}
		}}
	>
		{config.label}
	</a>
{/if}

<style lang="scss">
	:global {
		[data-widget='submit'] {
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

			+ [data-widget='submit'] {
				margin-top: 1rem;
			}
		}
	}
</style>
