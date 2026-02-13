<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const { handleCallback } = useStrivacity();

onMounted(async () => {
	const url = new URL(location.href);

	if (url.searchParams.has('session_id')) {
		await router.push(`/login?${url.searchParams}`);
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
