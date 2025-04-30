<script lang="ts" setup>
import type { LayoutWidget } from '@strivacity/sdk-core';
import type { LoginContext } from '@strivacity/sdk-vue';
import { inject, computed } from 'vue';

const props = defineProps<{ formId: string; type: LayoutWidget['type'] }>();
const loginContext = inject<LoginContext>('loginContext');
const disabled = computed(() => !!loginContext?.loading.value);

async function onSubmit() {
	if (disabled.value) {
		return;
	}

	await loginContext?.submitForm(props.formId);
}
</script>

<template>
	<form :data-form="formId" :data-type="type" @submit.prevent="onSubmit()">
		<slot />
	</form>
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
