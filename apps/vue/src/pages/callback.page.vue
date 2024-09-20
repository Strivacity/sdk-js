<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
	try {
		await handleCallback();
		await router.push('/profile');
	} catch {}
});
</script>

<template>
	<section v-if="$route.query.error">
		<h1>Error in authentication</h1>
		<div>
			<h4>{{ $route.query.error }}</h4>
			<p>{{ $route.query.error_description }}</p>
		</div>
	</section>
	<section v-else>
		<h1>Logging in...</h1>
	</section>
</template>
