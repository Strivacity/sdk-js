<script lang="ts" setup>
import type { SubmitWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-vue';
import { computed, inject } from 'vue';

const props = defineProps<{ formId: string; config: SubmitWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);

async function onSubmit(event: Event) {
	if (disabled.value) {
		return;
	}

	const form = (event.target as HTMLElement).closest('form');

	if (form?.dataset.formId === props.formId) {
		form.requestSubmit();
	} else {
		await context?.submitForm(props.formId);
	}
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

<style lang="scss" scoped>
[data-widget='submit'] {
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

	+ [data-widget='submit'] {
		margin-top: 1rem;
	}
}
</style>
