<script lang="ts">
	import type { CheckboxWidget } from '@strivacity/sdk-svelte/client';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: CheckboxWidget } = $props();

	const context = useNativeLoginContext();
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
