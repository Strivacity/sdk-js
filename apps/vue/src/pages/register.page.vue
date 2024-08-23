<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { register } = useStrivacity();

onMounted(async () => {
	await register();
	await router.push('/profile');
});
</script>

<template>
	<section>
		<h1>Redirecting...</h1>
	</section>
</template>
