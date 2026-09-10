<script setup lang="ts">
import { onMounted } from 'vue';
import type { RedirectFlow } from '@strivacity/sdk-vue';
import { useStrivacity } from '@strivacity/sdk-vue';
import { extraParams } from '../';

const props = defineProps<{
	flowType: 'login' | 'register';
}>();

const ctx = useStrivacity<RedirectFlow>();

onMounted(async () => {
	if (props.flowType === 'register') {
		await ctx.register();
	} else {
		await ctx.login(extraParams);
	}
});
</script>

<template>
	<section>Loading...</section>
</template>
