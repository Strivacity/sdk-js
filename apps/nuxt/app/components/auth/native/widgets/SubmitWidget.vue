<script lang="ts" setup>
import type { SubmitWidget } from '@strivacity/sdk-nuxt';
import { computed, useNativeLoginContext } from '#imports';

const props = defineProps<{ formId: string; config: SubmitWidget }>();

const { loading, submitForm } = useNativeLoginContext();
const disabled = computed(() => !!loading.value);

async function onSubmit(event: Event) {
	if (disabled.value) {
		return;
	}

	const form = (event.target as HTMLElement).closest('form');

	if (form?.dataset.formId === props.formId) {
		form.requestSubmit();
	} else {
		await submitForm(props.formId);
	}
}
</script>

<template>
	<button
		v-if="config.render?.type === 'button'"
		type="submit"
		:disabled="disabled"
		:style="{
			backgroundColor: config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? `#5d21ab` : `#ffffff`),
			color: config.render.textColor ?? (config.render.hint?.variant === 'primary' ? `#ffffff` : `#5d21ab`),
		}"
		data-widget="submit"
		data-type="button"
		:data-form-id="formId"
		:data-widget-id="config.id"
		@click.prevent="onSubmit($event)"
		@keydown.enter="onSubmit($event)"
		@keydown.space="onSubmit($event)"
	>
		{{ config.label }}
	</button>
	<a
		v-else
		data-widget="submit"
		data-type="link"
		:data-form-id="formId"
		:data-widget-id="config.id"
		tabindex="0"
		@click.prevent="onSubmit($event)"
		@keydown.enter="onSubmit($event)"
		@keydown.space="onSubmit($event)"
	>
		{{ config.label }}
	</a>
</template>
