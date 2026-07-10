<script setup lang="ts">
const router = useRouter();
const { revoke } = useStrivacity();

onMounted(async () => {
	try {
		await revoke();
		await router.push('/');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template></template>
