<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const { revoke } = useStrivacity();
const router = useRouter();

onMounted(async () => {
	try {
		await revoke();
		await router.push('/');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
