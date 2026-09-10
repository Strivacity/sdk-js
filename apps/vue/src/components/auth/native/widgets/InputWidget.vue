<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { type InputWidget, useNativeLoginContext } from '@strivacity/sdk-vue';

const props = defineProps<{ formId: string; config: InputWidget }>();

const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
const value = (forms.value[props.formId]?.[props.config.id] as string) || props.config.value;
const disabled = computed(() => !!loading.value || !!props.config.readonly);
const errorMessage = computed(() => messages.value[props.formId]?.[props.config.id]?.text);
const validator = computed(() => props.config.validator);
const autocomplete = computed(() => {
	if (props.config.autocomplete && props.config.render?.autocompleteHint) {
		return `${props.config.autocomplete} ${props.config.render.autocompleteHint}`;
	} else if (props.config.autocomplete) {
		return props.config.autocomplete;
	} else {
		return 'on';
	}
});

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
	<div data-widget="input" :data-form-id="formId" :data-widget-id="config.id">
		<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
		<input
			:id="config.id"
			:name="config.id"
			:autocomplete="autocomplete"
			:inputmode="config.inputmode"
			:readonly="disabled"
			:required="validator?.required"
			:minlength="validator?.minLength"
			:maxlength="validator?.maxLength"
			:pattern="validator?.regex"
			:value="value"
			type="text"
			size="1"
			@change="onChange($event)"
			@keydown.enter.stop="onKeyDown($event)"
		/>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>
