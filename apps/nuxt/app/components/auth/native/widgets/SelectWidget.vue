<script lang="ts" setup>
import type { SelectWidget } from '@strivacity/sdk-nuxt';
import { computed, useNativeLoginContext } from '#imports';

const props = defineProps<{ formId: string; config: SelectWidget }>();

const { loading, forms, messages, setFormValue } = useNativeLoginContext();
const formValues = computed<Record<string, unknown>>(() => forms.value[props.formId] ?? {});
const value = (forms.value[props.formId]?.[props.config.id] as string) || props.config.value;
const disabled = computed(() => !!loading.value || !!props.config.readonly);
const errorMessage = computed(() => messages.value[props.formId]?.[props.config.id]?.text);
const validator = computed(() => props.config.validator);

onMounted(() => {
	if (value) {
		setFormValue(props.formId, props.config.id, value);
	}
});

function onChange(event: Event) {
	if (disabled.value) {
		return;
	}

	setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<div data-widget="select" :data-form-id="formId" :data-widget-id="config.id">
		<template v-if="config.render?.type === 'radio'">
			<div v-for="option in config.options" :key="option.label" class="group">
				<template v-if="option.type === 'group'">
					<p>{{ option.label }}</p>
					<div v-for="subOption in option.options" :key="subOption.value" class="item">
						<input
							:id="subOption.value"
							type="radio"
							:name="config.id"
							:readonly="disabled"
							:value="subOption.value"
							:checked="subOption.value === formValues[config.id]"
							@change="onChange($event)"
						/>
						<label :for="subOption.value">{{ subOption.label }}</label>
					</div>
				</template>
				<template v-else>
					<input
						:id="option.value"
						type="radio"
						:name="config.id"
						:value="option.value"
						:checked="option.value === formValues[config.id]"
						@change="onChange($event)"
					/>
					<label :for="option.value">{{ option.label }}</label>
				</template>
			</div>
			<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
		</template>
		<template v-else>
			<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
			<select :id="config.id" :name="config.id" :disabled="disabled" :required="validator?.required" size="1" @change="onChange($event)">
				<template v-for="option in config.options" :key="option.label">
					<optgroup v-if="option.type === 'group'" :label="option.label">
						<option v-for="subOption in option.options" :key="subOption.value" :value="subOption.value" :selected="subOption.value === formValues[config.id]">
							{{ subOption.label }}
						</option>
					</optgroup>
					<option v-else :value="option.value" :selected="option.value === formValues[config.id]">
						{{ option.label }}
					</option>
				</template>
			</select>
			<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
		</template>
	</div>
</template>
