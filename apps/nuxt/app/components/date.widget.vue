<script lang="ts" setup>
import type { DateWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-vue';
import { DateTime } from 'luxon';

const props = defineProps<{ formId: string; config: DateWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');

const fieldLengths = { year: 4, month: 2, day: 2 };
const placeholders = {
	year: 'YYYY',
	month: 'MM',
	day: 'DD',
};
const format = ref<Array<'year' | 'month' | 'day'>>(['year', 'month', 'day']);
const year = ref<string>('');
const month = ref<string>('');
const day = ref<string>('');

const value = (context?.forms.value[props.formId]?.[props.config.id] as string) || props.config.value;
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);
const errorMessage = computed(() => context?.messages.value[props.formId]?.[props.config.id]?.text);
const validator = computed(() => props.config.validator);

setValues();

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

	context?.setFormValue(props.formId, props.config.id, value.toISODate());
}

function onChange(event: Event) {
	if (disabled.value) {
		return;
	}

	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}

async function onKeyDown(event: KeyboardEvent) {
	if (disabled.value) {
		return;
	}

	const input = event.target as HTMLInputElement;

	if (input.reportValidity()) {
		context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
		await context?.submitForm(props.formId);
	}
}
</script>

<template>
	<div data-widget="date" :data-form-id="formId" :data-widget-id="config.id">
		<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
		<div
			v-if="config.render.type === 'fieldSet'"
			:style="{ 'grid-template-columns': `${fieldLengths.year}fr ${fieldLengths.month}fr ${fieldLengths.day}fr` }"
			class="fieldset"
		>
			<input
				v-for="field in format"
				:key="field"
				:name="field"
				:readonly="disabled"
				:required="validator?.required"
				:value="value"
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

<style lang="scss" scoped>
[data-widget='date'] {
	display: flex;
	flex-direction: column;
	margin-block-start: 1rem;

	.fieldset {
		display: grid;
		gap: 0.5rem;
	}

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
</style>
