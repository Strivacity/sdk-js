<script lang="ts">
	import type { PhoneWidget } from '@strivacity/sdk-svelte/client';
	import { onMount } from 'svelte';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: PhoneWidget } = $props();

	const context = useNativeLoginContext();
	const disabled = $derived(context.loading || !!config.readonly);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);
	const validator = $derived(config.validator);
	const value = $derived((context.forms[formId]?.[config.id] as string) ?? config.value ?? '');

	onMount(() => {
		// Default value handling
		if (value.length > 0) {
			context.setFormValue(formId, config.id, value);
		}
	});

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

<div data-widget="phone" data-form-id={formId} data-widget-id={config.id}>
	{#if config.label}
		<label for={config.id} class="label">{config.label}</label>
	{/if}
	<input
		id={config.id}
		name={config.id}
		type={config.type}
		autocomplete="tel"
		inputmode="tel"
		readonly={disabled}
		required={validator?.required}
		value={value}
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
