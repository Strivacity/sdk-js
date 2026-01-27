<script lang="ts">
	import type { NativeFlowContextValue, MultiSelectWidget } from '@strivacity/sdk-svelte';
	import { getContext } from 'svelte';

	let { formId, config }: { formId: string; config: MultiSelectWidget } = $props();

	const context = getContext<NativeFlowContextValue>('nativeFlowContext');
	const disabled = $derived(context.loading || !!config.readonly);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);

	function onChange(event: Event) {
		if (disabled) {
			return;
		}

		const values = (context.forms[formId]?.[config.id] as Array<string>) || [];
		const value = (event.target as HTMLInputElement).value;

		context.setFormValue(formId, config.id, values.includes(value) ? values.filter((v: string) => v !== value) : [...values, value]);
	}
</script>

<div data-widget="multiselect" data-form-id={formId} data-widget-id={config.id}>
	{#each config.options as option (option.label)}
		<div class="item">
			{#if option.type === 'group'}
				<p>{option.label}</p>
				{#each option.options as subOption (subOption.value)}
					<div>
						<input
							id={subOption.value}
							type="checkbox"
							name={config.id}
							value={subOption.value}
							checked={subOption.value === context.forms[formId]?.[config.id]}
							onchange={onChange}
						/>
						<label for={subOption.value}>{subOption.label}</label>
					</div>
				{/each}
			{:else}
				<input
					id={option.value}
					type="checkbox"
					name={config.id}
					value={option.value}
					checked={option.value === context.forms[formId]?.[config.id]}
					onchange={onChange}
				/>
				<label for={option.value}>{option.label}</label>
			{/if}
		</div>
	{/each}
	{#if errorMessage}
		<small class="error">{errorMessage}</small>
	{/if}
</div>

<style lang="scss">
	:global {
		[data-widget='multiselect'] {
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

			.item + .item {
				margin-block-start: 0.5rem;
			}
		}
	}
</style>
