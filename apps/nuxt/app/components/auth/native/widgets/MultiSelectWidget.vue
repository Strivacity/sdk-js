<script lang="ts" setup>
import type { MultiSelectWidget } from '@strivacity/sdk-nuxt';
import { computed, onMounted, ref, watchEffect, useNativeLoginContext } from '#imports';

const props = defineProps<{ formId: string; config: MultiSelectWidget }>();

const { loading, forms, messages, setFormValue } = useNativeLoginContext();
const container = ref<HTMLElement>();
const selectedValues = computed<Array<string>>(() => (forms.value[props.formId]?.[props.config.id] as Array<string> | undefined) ?? []);
const disabled = computed(() => !!loading.value || !!props.config.readonly);
const errorMessage = computed(() => messages.value[props.formId]?.[props.config.id]?.text);
const minSelectable = computed(() => props.config.validator?.minSelectable ?? 0);
const maxSelectable = computed(() => props.config.validator?.maxSelectable ?? Infinity);

onMounted(() => {
	const value = (forms.value[props.formId]?.[props.config.id] as Array<string> | undefined) ?? props.config.value;

	if (value) {
		setFormValue(props.formId, props.config.id, value);
	}
});

watchEffect(() => {
	const message = selectedValues.value.length < minSelectable.value ? `Select at least ${minSelectable.value} option(s).` : '';
	container.value?.querySelector('input')?.setCustomValidity(message);
});

function isDisabled(value: string) {
	return disabled.value || (!selectedValues.value.includes(value) && selectedValues.value.length >= maxSelectable.value);
}

function onChange(event: Event) {
	const value = (event.target as HTMLInputElement).value;

	if (isDisabled(value)) {
		return;
	}

	const values = selectedValues.value;

	setFormValue(props.formId, props.config.id, values.includes(value) ? values.filter((v: string) => v !== value) : [...values, value]);
}
</script>

<template>
	<div ref="container" data-widget="multiselect" :data-form-id="formId" :data-widget-id="config.id">
		<div v-for="option in config.options" :key="option.label" class="item">
			<template v-if="option.type === 'group'">
				<p>{{ option.label }}</p>
				<div v-for="subOption in option.options" :key="subOption.value">
					<input
						:id="`${config.id}-${subOption.value}`"
						type="checkbox"
						:name="config.id"
						:value="subOption.value"
						:disabled="isDisabled(subOption.value)"
						:checked="selectedValues.includes(subOption.value)"
						@change="onChange($event)"
					/>
					<label :for="`${config.id}-${subOption.value}`">{{ subOption.label }}</label>
				</div>
			</template>
			<template v-else>
				<input
					:id="`${config.id}-${option.value}`"
					type="checkbox"
					:name="config.id"
					:value="option.value"
					:disabled="isDisabled(option.value)"
					:checked="selectedValues.includes(option.value)"
					@change="onChange($event)"
				/>
				<label :for="`${config.id}-${option.value}`">{{ option.label }}</label>
			</template>
		</div>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>
