<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';

const { sdk, logout } = useStrivacity();

onMounted(async () => {
	// This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSessionUri` setting.
	if (sdk.options.serverSessionUri) {
		globalThis.location.href = '/auth/logout';
		return;
	} else {
		await logout();
	}
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
