<script setup lang="ts">
const router = useRouter();
const { handleCallback } = useStrivacity();
const searchParams = new URLSearchParams(globalThis.window?.location.search);

onMounted(async () => {
	if (searchParams.get('error') || searchParams.get('error_description')) {
		return await router.replace(`/error?${searchParams.toString()}`);
	}

	try {
		await handleCallback();
		await router.push('/profile');
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template></template>
