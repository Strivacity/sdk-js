<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const { handleCallback } = useStrivacity();
const router = useRouter();
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

<template>
	<section>
		<h1>Logging in...</h1>
	</section>
</template>
