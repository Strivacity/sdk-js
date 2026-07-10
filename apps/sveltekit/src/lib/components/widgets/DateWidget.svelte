<script lang="ts">
	import type { DateWidget } from '@strivacity/sdk-svelte/client';
	import { onMount } from 'svelte';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: DateWidget } = $props();

	const context = useNativeLoginContext();
	const fieldLengths = { year: 4, month: 2, day: 2 };
	const placeholders = {
		year: 'YYYY',
		month: 'MM',
		day: 'DD',
	};
	const format = $state<Array<'year' | 'month' | 'day'>>(['year', 'month', 'day']);
	let year = $state<string>('');
	let month = $state<string>('');
	let day = $state<string>('');

	const value = $derived((context.forms[formId]?.[config.id] as string) || config.value);
	const disabled = $derived(context.loading || !!config.readonly);
	const errorMessage = $derived(context.messages[formId]?.[config.id]?.text);
	const validator = $derived(config.validator);

	onMount(() => {
		// Default value handling
		if (value && value.length > 0) {
			context.setFormValue(formId, config.id, value);
		}
		setValues();
	});

	function setValues() {
		if (!value) {
			return;
		}

		// Simple date parsing without luxon
		const [y, m, d] = value.split('-');
		year = y || '';
		month = m || '';
		day = d || '';
	}

	function onFieldsetChange(event: Event) {
		if (disabled) {
			return;
		}

		const input = event.target as HTMLInputElement;
		const field = input.name;

		if (field === 'year') {
			year = input.value.padStart(4, '0');
		} else if (field === 'month') {
			month = input.value.padStart(2, '0');
		} else if (field === 'day') {
			day = input.value.padStart(2, '0');
		}

		const dateValue = `${year}-${month}-${day}`;
		context.setFormValue(formId, config.id, dateValue);
	}

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

<div data-widget="date" data-form-id={formId} data-widget-id={config.id}>
	{#if config.label}
		<label for={config.id} class="label">{config.label}</label>
	{/if}
	{#if config.render?.type === 'fieldSet'}
		<div class="fieldset" style:grid-template-columns="{fieldLengths.year}fr {fieldLengths.month}fr {fieldLengths.day}fr">
			{#each format as field (field)}
				<input
					name={field}
					readonly={disabled}
					required={validator?.required}
					value={field === 'year' ? year : field === 'month' ? month : day}
					placeholder={placeholders[field]}
					type="text"
					size="1"
					onchange={onFieldsetChange}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							void onKeyDown(e);
						}
					}}
				/>
			{/each}
		</div>
	{:else}
		<input
			id={config.id}
			name={config.id}
			readonly={disabled}
			required={validator?.required}
			value={value}
			type="date"
			size="1"
			onchange={onChange}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					void onKeyDown(e);
				}
			}}
		/>
	{/if}
	{#if errorMessage}
		<small class="error">{errorMessage}</small>
	{/if}
</div>
