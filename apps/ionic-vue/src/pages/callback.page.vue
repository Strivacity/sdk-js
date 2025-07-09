<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStrivacity } from '@strivacity/sdk-vue';

const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
	const url = new URL(location.href);
	const sessionId = url.searchParams.get('session_id');

	if (sessionId) {
		await router.push(`/login?session_id=${sessionId}`);
	} else {
		try {
			await handleCallback();
			await router.push('/profile');
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Error during callback handling:', error);
		}
	}
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
