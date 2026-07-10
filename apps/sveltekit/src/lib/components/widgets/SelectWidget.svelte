<script lang="ts">
	import type { SelectWidget } from '@strivacity/sdk-svelte/client';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: SelectWidget } = $props();

	const context = useNativeLoginContext();
	const disabled = $derived(context.loading || !!config.readonly);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);
	const validator = $derived(config.validator);

	// svelte-ignore state_referenced_locally
	if (config.value) {
		context.setFormValue(formId, config.id, config.value);
	}

	function onChange(event: Event) {
		if (disabled) {
			return;
		}

		context.setFormValue(formId, config.id, (event.target as HTMLInputElement).value);
	}
</script>

<div data-widget="select" data-form-id={formId} data-widget-id={config.id}>
	{#if config.render?.type === 'radio'}
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
