<script lang="ts" setup>
import type { PasswordWidget } from '@strivacity/sdk-nuxt';
import { computed, useNativeLoginContext } from '#imports';

const props = defineProps<{ formId: string; config: PasswordWidget }>();

const { loading, forms, messages, setFormValue, submitForm } = useNativeLoginContext();
const value = forms.value[props.formId]?.[props.config.id] as string;
const disabled = computed(() => !!loading.value);
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
	<div data-widget="password" :data-form-id="formId" :data-widget-id="config.id">
		<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
		<input
			:id="config.id"
			:name="config.id"
			:readonly="disabled"
			type="password"
			required
			size="1"
			@change="onChange($event)"
			@keydown.enter.stop="onKeyDown($event)"
		/>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>
