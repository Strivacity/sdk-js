<script setup lang="ts">
import { onMounted } from 'vue';
import type { PopupFlow } from '@strivacity/sdk-nuxt';
import { useStrivacity } from '#imports';
import { extraParams } from '../';

const props = defineProps<{
	flowType: 'login' | 'register';
}>();

const { login, register } = useStrivacity<PopupFlow>();

onMounted(async () => {
	try {
		if (props.flowType === 'register') {
			await register(extraParams);
		} else {
			await login(extraParams);
		}

		globalThis.location.href = '/profile';
	} catch (error) {
		globalThis.location.href = `/error?error_description=${encodeURIComponent(error.message)}`;
	}
});
</script>

<template>
	<section>Loading...</section>
</template>
