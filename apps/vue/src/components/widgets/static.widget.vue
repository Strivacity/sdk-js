<script lang="ts" setup>
import type { StaticWidget } from '@strivacity/sdk-core';

defineProps<{ formId: string; config: StaticWidget }>();
</script>

<template>
	<div v-if="config.render.type === 'html'" v-html="config.value"></div>
	<div v-else>{{ config.value }}</div>
</template>

<style lang="scss" scoped>
[data-widget='static'] {
	text-align: center;

	:deep(p) {
		margin: 0;
	}

	&[data-widget-id='section-title'] {
		font-size: 1.5rem;
		font-weight: 600;
	}

	&:not(:has(+ [data-widget='submit'])) {
		margin-block-end: 0.5rem;
	}
}
</style>
