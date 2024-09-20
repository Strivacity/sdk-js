<script setup lang="ts">
const { revoke } = useStrivacity();
const router = useRouter();

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
