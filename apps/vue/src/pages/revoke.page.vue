<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { revoke } = useStrivacity();

onMounted(async () => {
	try {
		await revoke();
	} catch {
	} finally {
		await router.push('/');
	}
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
