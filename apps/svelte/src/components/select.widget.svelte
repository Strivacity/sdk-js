<script lang="ts">
	import type { NativeFlowContextValue, SelectWidget } from '@strivacity/sdk-svelte';
	import { getContext } from 'svelte';

	let { formId, config }: { formId: string; config: SelectWidget } = $props();

	const context = getContext<NativeFlowContextValue>('nativeFlowContext');
	const disabled = $derived(context.loading || !!config.readonly);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);
	const validator = $derived(config.validator);

	function onChange(event: Event) {
		if (disabled) {
			return;
		}

		context.setFormValue(formId, config.id, (event.target as HTMLInputElement).value);
	}
</script>

<div data-widget="select" data-form-id={formId} data-widget-id={config.id}>
	{#if config.render.type === 'radio'}
		{#each config.options as option (option.label)}
			<div class="group">
				{#if option.type === 'group'}
					<p>{option.label}</p>
					{#each option.options as subOption (subOption.value)}
						<div class="item">
							<input
								id={subOption.value}
								type="radio"
								name={config.id}
								readonly={disabled}
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
						type="radio"
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
	{:else}
		{#if config.label}
			<label for={config.id} class="label">{config.label}</label>
		{/if}
		<select id={config.id} name={config.id} disabled={disabled} required={validator?.required} size="1" onchange={onChange}>
			{#each config.options as option (option.label)}
				{#if option.type === 'group'}
					<optgroup label={option.label}>
						{#each option.options as subOption (subOption.value)}
							<option value={subOption.value} selected={subOption.value === context.forms[formId]?.[config.id]}>
								{subOption.label}
							</option>
						{/each}
					</optgroup>
				{:else}
					<option value={option.value} selected={option.value === context.forms[formId]?.[config.id]}>
						{option.label}
					</option>
				{/if}
			{/each}
		</select>
		{#if errorMessage}
			<small class="error">{errorMessage}</small>
		{/if}
	{/if}
</div>

<style lang="scss">
	:global {
		[data-widget='select'] {
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
			}

			.item {
				display: flex;
				align-items: center;

				+ .item {
					margin-block-start: 0.5rem;
				}
			}

			select {
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
