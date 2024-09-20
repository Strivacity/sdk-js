<script setup lang="ts">
const { handleCallback } = useStrivacity();
const router = useRouter();

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
