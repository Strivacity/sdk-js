<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const { sdk, revoke } = useStrivacity();
const router = useRouter();

onMounted(async () => {
	// This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSessionUri` setting.
	if (sdk.options.serverSessionUri) {
		globalThis.location.href = '/auth/revoke';
		return;
	} else {
		try {
			await revoke();
			await router.push('/');
		} catch (error) {
			await router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	}
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
