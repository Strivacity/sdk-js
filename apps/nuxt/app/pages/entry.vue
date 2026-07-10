<script setup lang="ts">
import type { NativeFlow } from '@strivacity/sdk-nuxt';

const router = useRouter();
const { sdk, entry } = useStrivacity<NativeFlow>();

onMounted(async () => {
	try {
		const params = await entry();
		const url = new URL('/login', globalThis.location.origin);
		url.search = new URLSearchParams(params).toString();
		globalThis.location.href = url.toString();
	} catch (error) {
		await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
	}
});
</script>

<template></template>
