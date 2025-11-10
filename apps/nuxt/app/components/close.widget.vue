<script lang="ts" setup>
import type { NativeFlowContextValue, CloseWidget } from '@strivacity/sdk-nuxt';
import { computed, inject } from 'vue';

defineProps<{ formId: string; config: CloseWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);

function onClose() {
	if (disabled.value) {
		return;
	}

	context?.triggerClose();
}
</script>

<template>
	<button
		v-if="config.render.type === 'button'"
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

<style lang="scss" scoped>
[data-widget='close'] {
	cursor: pointer;
	outline-color: #5d21ab;

	&[data-type='button'] {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-block: 1rem;
		min-height: 2.25rem;
		padding: 0.5rem 1rem;
		font-size: 1rem;
		box-shadow: rgb(0 0 0 / 5%) 0 1px 2px 0;
		border: 1px solid rgb(0 0 0 / 15%);
		border-radius: 4px;
		position: relative;

		&:disabled {
			cursor: not-allowed;
			background-color: #f5f5f5 !important;
			color: #bdbdbd !important;
			border-color: #e0e0e0;
			box-shadow: none;
		}
	}

	&[data-type='link'] {
		display: inline-block;
		text-align: center;
		color: #5d21ab;

		&:hover {
			color: oklch(from #5d21ab l calc(l * 0.85) c h);
		}
	}

	+ [data-widget='close'] {
		margin-top: 1rem;
	}
}
</style>
