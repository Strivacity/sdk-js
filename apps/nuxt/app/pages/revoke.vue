<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const { isAuthenticated, revoke } = useStrivacity();

onMounted(async () => {
	if (isAuthenticated.value) {
		await revoke();
	}

	await router.push('/');
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
