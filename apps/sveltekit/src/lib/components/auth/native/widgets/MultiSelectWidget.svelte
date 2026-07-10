<script lang="ts">
	import type { MultiSelectWidget } from '@strivacity/sdk-svelte/client';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: MultiSelectWidget } = $props();

	const context = useNativeLoginContext();
	const disabled = $derived(context.loading || !!config.readonly);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);

	// svelte-ignore state_referenced_locally
	if (config.value?.length) {
		context.setFormValue(formId, config.id, config.value);
	}

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
