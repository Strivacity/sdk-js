<script lang="ts" setup>
import { computed } from 'vue';
import { type CloseWidget, useNativeLoginContext } from '@strivacity/sdk-vue';

defineProps<{ formId: string; config: CloseWidget }>();

const { loading, triggerClose } = useNativeLoginContext();
const disabled = computed(() => !!loading.value);

function onClose() {
	if (disabled.value) {
		return;
	}

	triggerClose();
}
</script>

<template>
	<button
		v-if="config.render?.type === 'button'"
		:disabled="disabled"
		:style="{
			backgroundColor: config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? `#5d21ab` : `#ffffff`),
			color: config.render.textColor ?? (config.render.hint?.variant === 'primary' ? `#ffffff` : `#5d21ab`),
		}"
		data-widget="close"
		data-type="button"
		:data-form-id="formId"
		:data-widget-id="config.id"
		@click.prevent="onClose()"
		@keydown.enter="onClose()"
		@keydown.space="onClose()"
	>
		{{ config.label }}
	</button>
	<a
		v-else
		data-widget="close"
		data-type="link"
		:data-form-id="formId"
		:data-widget-id="config.id"
		tabindex="0"
		@click.prevent="onClose()"
		@keydown.enter="onClose()"
		@keydown.space="onClose()"
	>
		{{ config.label }}
	</a>
</template>
