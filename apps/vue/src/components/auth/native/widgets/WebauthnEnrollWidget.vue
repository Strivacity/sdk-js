<script lang="ts" setup>
import { computed } from 'vue';
import { type WebauthnEnrollWidget, createWebAuthnCredential, useNativeLoginContext } from '@strivacity/sdk-vue';

const props = defineProps<{ formId: string; config: WebauthnEnrollWidget }>();

const { loading, setFormValue, submitForm } = useNativeLoginContext();
const disabled = computed(() => !!loading.value);

async function onClick() {
	if (disabled.value) {
		return;
	}

	try {
		const response = await createWebAuthnCredential(props.config.enrollOptions);
		setFormValue(props.formId, props.config.id, response);
		await submitForm(props.formId);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error(error);
		alert('Enrollment failed. Please try again.');
	}
}
</script>

<template>
	<button
		v-if="config.render?.type === 'button'"
		type="button"
		:disabled="disabled"
		data-widget="webauthnEnroll"
		data-type="button"
		:data-form-id="formId"
		:data-widget-id="config.id"
		@click.prevent="onClick()"
		@keydown.enter="onClick()"
		@keydown.space="onClick()"
	>
		{{ config.label }}
	</button>
	<a
		v-else
		data-widget="webauthnEnroll"
		data-type="link"
		:data-form-id="formId"
		:data-widget-id="config.id"
		tabindex="0"
		@click.prevent="onClick()"
		@keydown.enter="onClick()"
		@keydown.space="onClick()"
	>
		{{ config.label }}
	</a>
</template>
