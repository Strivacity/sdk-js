<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { onMounted } from 'vue';

const { logout } = useStrivacity();

onMounted(async () => {
	await logout();
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
