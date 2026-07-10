<script lang="ts" setup>
import type { MultiSelectWidget } from '@strivacity/sdk-nuxt';
import { computed, onMounted, useNativeLoginContext } from '#imports';

const props = defineProps<{ formId: string; config: MultiSelectWidget }>();

const { loading, forms, messages, setFormValue } = useNativeLoginContext();
const formValues = computed<Record<string, unknown>>(() => forms.value[props.formId] ?? {});
const selectedValues = computed<Array<string>>(() => (formValues.value[props.config.id] as Array<string>) ?? []);
const value = (forms.value[props.formId]?.[props.config.id] as string) || props.config.value;
const disabled = computed(() => !!loading.value || !!props.config.readonly);
const errorMessage = computed(() => messages.value[props.formId]?.[props.config.id]?.text);

onMounted(() => {
	if (value) {
		setFormValue(props.formId, props.config.id, value);
	}
});

function onChange(event: Event) {
	if (disabled.value) {
		return;
	}

	const values = (forms.value[props.formId]?.[props.config.id] as Array<string>) || [];
	const value = (event.target as HTMLInputElement).value;

	setFormValue(props.formId, props.config.id, values.includes(value) ? values.filter((v: string) => v !== value) : [...values, value]);
}
</script>

<template>
	<div data-widget="multiselect" :data-form-id="formId" :data-widget-id="config.id">
		<div v-for="option in config.options" :key="option.label" class="item">
			<template v-if="option.type === 'group'">
				<p>{{ option.label }}</p>
				<div v-for="subOption in option.options" :key="subOption.value">
					<input
						:id="subOption.value"
						type="checkbox"
						:name="config.id"
						:value="subOption.value"
						:checked="selectedValues.includes(subOption.value)"
						@change="onChange($event)"
					/>
					<label :for="subOption.value">{{ subOption.label }}</label>
				</div>
			</template>
			<template v-else>
				<input
					:id="option.value"
					type="checkbox"
					:name="config.id"
					:value="option.value"
					:checked="selectedValues.includes(option.value)"
					@change="onChange($event)"
				/>
				<label :for="option.value">{{ option.label }}</label>
			</template>
		</div>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>
