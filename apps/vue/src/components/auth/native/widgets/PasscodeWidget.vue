<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { type PasscodeWidget, useNativeLoginContext } from '@strivacity/sdk-vue';

const props = defineProps<{ formId: string; config: PasscodeWidget }>();

const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
const value = forms.value[props.formId]?.[props.config.id] as string;
const disabled = computed(() => !!loading.value);
const errorMessage = computed(() => messages.value[props.formId]?.[props.config.id]?.text);
const validator = computed(() => props.config.validator);

onMounted(() => {
	if (value) {
		setFormValue(props.formId, props.config.id, value);
	}
});

function onInput(event: InputEvent) {
	const inputElement = event.target as HTMLInputElement;
	inputElement.value = inputElement.value.replace(/\D/g, '');
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
	<div data-widget="passcode" :data-form-id="formId" :data-widget-id="config.id">
		<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
		<input
			:id="config.id"
			:name="config.id"
			:type="config.type"
			:readonly="disabled"
			:minlength="validator?.length"
			:maxlength="validator?.length"
			autocomplete="off"
			inputmode="numeric"
			size="1"
			@input="onInput($event as InputEvent)"
			@change="onChange($event)"
			@keydown.enter.stop="onKeyDown($event)"
		/>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>
