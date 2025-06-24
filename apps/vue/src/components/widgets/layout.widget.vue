<script lang="ts" setup>
import type { LayoutWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-vue';
import { inject, computed } from 'vue';

const props = withDefaults(defineProps<{ formId: string; type: LayoutWidget['type']; tag?: string }>(), {
	tag: 'div',
});
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);

async function onSubmit() {
	if (disabled.value) {
		return;
	}

	await context?.submitForm(props.formId);
}
</script>

<template>
	<component :is="tag" data-widget="layout" :data-type="type" :data-form-id="formId" @submit.prevent="onSubmit()">
		<slot />
	</component>
</template>

<style lang="scss" scoped>
[data-widget='layout'] {
	display: flex;
	flex-direction: column;
	width: 100%;
	margin-block-end: 1rem;

	&[data-type='horizontal'] {
		flex-direction: row;
		align-items: center;
		justify-content: center;

		* + * {
			margin-inline-start: 0.25rem;
		}
	}

	&[data-type='vertical'] {
		flex-direction: column;
		justify-content: center;
	}
}
</style>
