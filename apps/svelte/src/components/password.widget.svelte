<script lang="ts">
	import type { NativeFlowContextValue, PasswordWidget } from '@strivacity/sdk-svelte';
	import { getContext } from 'svelte';

	let { formId, config }: { formId: string; config: PasswordWidget } = $props();

	const context = getContext<NativeFlowContextValue>('nativeFlowContext');
	const disabled = $derived(context.loading);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);

	function onChange(event: Event) {
		if (disabled) {
			return;
		}

		context.setFormValue(formId, config.id, (event.target as HTMLInputElement).value);
	}

	async function onKeyDown(event: KeyboardEvent) {
		if (disabled) {
			return;
		}

		const input = event.target as HTMLInputElement;

		if (input.reportValidity()) {
			context.setFormValue(formId, config.id, (event.target as HTMLInputElement).value);
			await context.submitForm(formId);
		}
	}
</script>

<div data-widget="password" data-form-id={formId} data-widget-id={config.id}>
	{#if config.label}
		<label for={config.id} class="label">{config.label}</label>
	{/if}
	<input
		id={config.id}
		name={config.id}
		readonly={disabled}
		type="password"
		required
		size="1"
		onchange={onChange}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.stopPropagation();
				void onKeyDown(e);
			}
		}}
	/>
	{#if errorMessage}
		<small class="error">{errorMessage}</small>
	{/if}
</div>

<style lang="scss">
	:global {
		[data-widget='password'] {
			display: flex;
			flex-direction: column;
			margin-block-start: 1rem;

			.label {
				margin-block-end: 0.25rem;
			}

			input {
				position: relative;
				display: flex;
				align-items: center;
				height: 2.5rem;
				padding-inline: 0.5rem;
				font-size: 1rem;
				background: hsl(0deg 0% 100%);
				border-width: 1px;
				border-style: solid;
				border-color: hsl(0deg 0% 90%);
				border-radius: 4px;
				box-shadow: rgb(0 0 0 / 5%) 0 1px 2px 0;
				transition:
					color 150ms ease-in-out,
					background 150ms ease-in-out,
					border-color 150ms ease-in-out;

				&:focus {
					outline: none;
					border-color: #5d21ab;
				}

				&:read-only {
					color: hsl(0deg 0% 50%);
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
