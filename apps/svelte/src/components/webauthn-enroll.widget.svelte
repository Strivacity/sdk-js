<script lang="ts">
	import type { NativeFlowContextValue, PasskeyEnrollWidget } from '@strivacity/sdk-svelte';
	import { getContext } from 'svelte';
	import { createCredential } from '@strivacity/sdk-core/utils/credentials';

	let { formId, config }: { formId: string; config: PasskeyEnrollWidget } = $props();

	const context = getContext<NativeFlowContextValue>('nativeFlowContext');
	const disabled = $derived(context.loading);

	async function onClick() {
		if (disabled) {
			return;
		}

		try {
			const response = await createCredential(config.enrollOptions);
			context.setFormValue(formId, config.id, response);
			await context.submitForm(formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Enrollment failed. Please try again.');
		}
	}
</script>

{#if config.render.type === 'button'}
	<button
		type="button"
		disabled={disabled}
		data-widget="webauthnEnroll"
		data-type="button"
		data-form-id={formId}
		data-widget-id={config.id}
		onclick={(e) => {
			e.preventDefault();
			void onClick();
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				void onClick();
			}
		}}
	>
		{config.label}
	</button>
{:else}
	<!-- svelte-ignore a11y_missing_attribute -->
	<a
		data-widget="webauthnEnroll"
		data-type="link"
		data-form-id={formId}
		data-widget-id={config.id}
		tabindex="0"
		role="button"
		onclick={(e) => {
			e.preventDefault();
			void onClick();
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				void onClick();
			}
		}}
	>
		{config.label}
	</a>
{/if}

<style lang="scss">
	:global {
		[data-widget='webauthnEnroll'] {
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
		}
	}
</style>
