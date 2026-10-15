<script lang="ts">
	import type { MultiSelectWidget } from '@strivacity/sdk-svelte/client';
	import { onMount } from 'svelte';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: MultiSelectWidget } = $props();

	const context = useNativeLoginContext();
	let container = $state<HTMLDivElement>();
	const selectedValues = $derived((context.forms[formId]?.[config.id] as Array<string> | undefined) ?? []);
	const disabled = $derived(context.loading || !!config.readonly);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);
	const minSelectable = $derived(config.validator?.minSelectable ?? 0);
	const maxSelectable = $derived(config.validator?.maxSelectable ?? Infinity);

	onMount(() => {
		const value = (context.forms[formId]?.[config.id] as Array<string> | undefined) ?? config.value;

		if (value) {
			context.setFormValue(formId, config.id, value);
		}
	});

	$effect(() => {
		const message = selectedValues.length < minSelectable ? `Select at least ${minSelectable} option(s).` : '';
		container?.querySelector('input')?.setCustomValidity(message);
	});

	function isDisabled(value: string) {
		return disabled || (!selectedValues.includes(value) && selectedValues.length >= maxSelectable);
	}

	function onChange(event: Event) {
		const value = (event.target as HTMLInputElement).value;

		if (isDisabled(value)) {
			return;
		}

		const values = selectedValues;

		context.setFormValue(formId, config.id, values.includes(value) ? values.filter((v: string) => v !== value) : [...values, value]);
	}
</script>

<div bind:this={container} data-widget="multiselect" data-form-id={formId} data-widget-id={config.id}>
	{#each config.options as option (option.label)}
		<div class="item">
			{#if option.type === 'group'}
				<p>{option.label}</p>
				{#each option.options as subOption (subOption.value)}
					<div>
						<input
							id="{config.id}-{subOption.value}"
							type="checkbox"
							name={config.id}
							value={subOption.value}
							disabled={isDisabled(subOption.value)}
							checked={selectedValues.includes(subOption.value)}
							onchange={onChange}
						/>
						<label for="{config.id}-{subOption.value}">{subOption.label}</label>
					</div>
				{/each}
			{:else}
				<input
					id="{config.id}-{option.value}"
					type="checkbox"
					name={config.id}
					value={option.value}
					disabled={isDisabled(option.value)}
					checked={selectedValues.includes(option.value)}
					onchange={onChange}
				/>
				<label for="{config.id}-{option.value}">{option.label}</label>
			{/if}
		</div>
	{/each}
	{#if errorMessage}
		<small class="error">{errorMessage}</small>
	{/if}
</div>
