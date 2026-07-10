<script lang="ts" setup>
import { computed } from 'vue';
import { type CheckboxWidget, useNativeLoginContext } from '@strivacity/sdk-vue';

const props = defineProps<{ formId: string; config: CheckboxWidget }>();

const { loading, forms, messages, setFormValue } = useNativeLoginContext();
const disabled = computed(() => !!loading.value);
const checked = computed(() => (forms.value[props.formId]?.[props.config.id] as boolean) || props.config.value || false);
const errorMessage = computed(() => messages.value[props.formId]?.[props.config.id]?.text);

function onChange(checked: boolean) {
	if (disabled.value) {
		return;
	}

	setFormValue(props.formId, props.config.id, checked);
}
</script>

<template>
	<div data-widget="checkbox" :data-form-id="formId" :data-widget-id="config.id">
		<div>
			<input
				:id="config.id"
				:name="config.id"
				:disabled="disabled"
				:required="config.validator?.required"
				:checked="checked"
				type="checkbox"
				size="1"
				@change="onChange(($event.target as HTMLInputElement).checked)"
			/>
			<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
		</div>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>
