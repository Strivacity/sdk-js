<script setup lang="ts">
const { register } = useStrivacity();
const router = useRouter();

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
