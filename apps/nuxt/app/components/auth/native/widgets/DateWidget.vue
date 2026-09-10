<script lang="ts" setup>
import type { DateWidget } from '@strivacity/sdk-nuxt';
import { DateTime } from 'luxon';
import { ref, computed, onMounted, useNativeLoginContext } from '#imports';

const fieldLengths = { year: 4, month: 2, day: 2 };
const placeholders = { year: 'YYYY', month: 'MM', day: 'DD' };

const props = defineProps<{ formId: string; config: DateWidget }>();

const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
const value = (forms.value[props.formId]?.[props.config.id] as string) || props.config.value;
const disabled = computed(() => !!loading.value || !!props.config.readonly);
const errorMessage = computed(() => messages.value[props.formId]?.[props.config.id]?.text);
const validator = computed(() => props.config.validator);
const format = ref<Array<'year' | 'month' | 'day'>>(['year', 'month', 'day']);
const year = ref<string>('');
const month = ref<string>('');
const day = ref<string>('');
const fieldValues = computed<Record<'year' | 'month' | 'day', string>>(() => ({ year: year.value, month: month.value, day: day.value }));

onMounted(() => {
	if (value) {
		setFormValue(props.formId, props.config.id, value);
		setValues();
	}
});

function setValues() {
	if (!value) {
		return;
	}

	const date = DateTime.fromISO(value);

	if (date.isValid) {
		const [y, m, d] = value.split('-');

		year.value = y || '';
		month.value = m || '';
		day.value = d || '';
	}
}

function onFieldsetChange(event: Event) {
	if (disabled.value) {
		return;
	}

	const input = event.target as HTMLInputElement;
	const field = input.name;

	if (field === 'year') {
		year.value = input.value.padStart(4, '0');
	} else if (field === 'month') {
		month.value = input.value.padStart(2, '0');
	} else if (field === 'day') {
		day.value = input.value.padStart(2, '0');
	}

	const value = DateTime.fromObject({
		year: Number(year.value),
		month: Number(month.value),
		day: Number(day.value),
	});

	setFormValue(props.formId, props.config.id, value.toISODate());
}

function onChange(event: Event) {
	if (disabled.value) {
		return;
	}

	setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}

async function onKeyDown(event: KeyboardEvent) {
	if (disabled.value) {
		return;
	}

	const input = event.target as HTMLInputElement;

	if (input.reportValidity()) {
		setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
		await submitForm(props.formId);
	}
}
</script>

<template>
	<div data-widget="date" :data-form-id="formId" :data-widget-id="config.id">
		<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
		<div
			v-if="config.render?.type === 'fieldSet'"
			:style="{ 'grid-template-columns': `${fieldLengths.year}fr ${fieldLengths.month}fr ${fieldLengths.day}fr` }"
			class="fieldset"
		>
			<input
				v-for="field in format"
				:key="field"
				:name="field"
				:readonly="disabled"
				:required="validator?.required"
				:value="fieldValues[field]"
				:placeholder="placeholders[field]"
				type="text"
				size="1"
				@change="onFieldsetChange($event)"
				@keydown.enter="onKeyDown($event)"
			/>
		</div>
		<input
			v-else
			:id="config.id"
			:name="config.id"
			:readonly="disabled"
			:required="validator?.required"
			:value="value"
			type="date"
			size="1"
			@change="onChange($event)"
			@keydown.enter="onKeyDown($event)"
		/>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>
