<script lang="ts" setup>
import type { NativeFlowContextValue, PasskeyLoginWidget } from '@strivacity/sdk-nuxt';
import { computed, inject } from 'vue';

const props = defineProps<{ formId: string; config: PasskeyLoginWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);

async function onClick() {
	if (!context || disabled.value) {
		return;
	}

	try {
		const response = await getCredential(props.config.assertionOptions);
		context.setFormValue(props.formId, props.config.id, response);
		await context.submitForm(props.formId);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error(error);
		alert('Authentication failed. Please try again.');
	}
}
</script>

<template>
	<button
		v-if="config.render.type === 'button'"
		type="button"
		:disabled="disabled"
		data-widget="passkeyLogin"
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
		data-widget="passkeyLogin"
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

<style lang="scss" scoped>
[data-widget='passkeyLogin'] {
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
}
</style>
