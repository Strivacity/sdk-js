<script lang="ts" setup>
import type { LayoutWidget } from '@strivacity/sdk-nuxt';
import { computed, useNativeLoginContext } from '#imports';

const props = withDefaults(defineProps<{ formId: string; type: LayoutWidget['type']; tag?: string }>(), {
	tag: 'div',
});

const { loading, submitForm } = useNativeLoginContext();
const disabled = computed(() => !!loading.value);

async function onSubmit() {
	if (disabled.value) {
		return;
	}

	await submitForm(props.formId);
}
</script>

<template>
	<component :is="tag" data-widget="layout" :data-type="type" :data-form-id="formId" @submit.prevent="onSubmit()">
		<slot />
	</component>
</template>
