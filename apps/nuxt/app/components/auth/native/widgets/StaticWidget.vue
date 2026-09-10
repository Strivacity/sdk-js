<script lang="ts" setup>
import type { StaticWidget } from '@strivacity/sdk-nuxt';

defineProps<{ formId: string; config: StaticWidget }>();
</script>

<template>
	<div v-if="config.render?.type === 'html'" data-widget="static" :data-form-id="formId" :data-widget-id="config.id" v-html="config.value"></div>
	<div v-else data-widget="static" :data-form-id="formId" :data-widget-id="config.id">{{ config.value }}</div>
</template>
