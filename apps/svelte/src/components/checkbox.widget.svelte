<script lang="ts">
	import { getContext } from 'svelte';
	import type { NativeFlowContextValue, CheckboxWidget } from '@strivacity/sdk-svelte';

	let { formId, config }: { formId: string; config: CheckboxWidget } = $props();

	const context = getContext<NativeFlowContextValue>('nativeFlowContext');
	const disabled = $derived(context.loading);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);
	const validator = $derived(config.validator);

	function onChange(event: Event) {
		if (disabled) {
			return;
		}

		context.setFormValue(formId, config.id, (event.target as HTMLInputElement).checked);
	}
</script>

<div data-widget="checkbox" data-form-id={formId} data-widget-id={config.id}>
	<div>
		<input
			id={config.id}
			name={config.id}
			disabled={disabled}
			required={validator?.required}
			checked={(context.forms[formId]?.[config.id] as boolean) || config.value || false}
			type="checkbox"
			size="1"
			onchange={onChange}
		/>
		{#if config.label}
			<label for={config.id} class="label">{config.label}</label>
		{/if}
	</div>
	{#if errorMessage}
		<small class="error">{errorMessage}</small>
	{/if}
</div>

<style lang="scss">
	:global {
		[data-widget='checkbox'] {
			display: flex;
			flex-direction: column;
			margin-block-start: 1rem;

			.label {
				margin-block-end: 0.25rem;
			}

			input {
				transform: scale(1.4);
				margin-inline-end: 0.5rem;
				accent-color: #5d21ab;
				outline-color: #5d21ab;

				&:disabled {
					background: hsl(0deg 0% 98%);
					border-color: hsl(0deg 0% 90%);
					cursor: not-allowed;
				}
			}

			.error {
				margin-block-start: 0.25rem;
				color: #e40c0c;
			}
		}
	}
</style>
