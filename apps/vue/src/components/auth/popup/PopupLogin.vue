<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { PopupFlow } from '@strivacity/sdk-vue';
import { useStrivacity } from '@strivacity/sdk-vue';
import { extraParams } from '../';

const props = defineProps<{
	flowType: 'login' | 'register';
}>();

const router = useRouter();
const ctx = useStrivacity<PopupFlow>();

onMounted(async () => {
	try {
		if (props.flowType === 'register') {
			await ctx.register(extraParams);
		} else {
			await ctx.login(extraParams);
		}

		globalThis.location.href = '/profile';
	} catch (error) {
		globalThis.location.href = `/error?error_description=${encodeURIComponent(error.message)}`;
		await router.push(`/error?error_description=${encodeURIComponent(error.message)}`);
	}
});
</script>

<template>
	<section>Loading...</section>
</template>
