<script setup lang="ts">
const { login } = useStrivacity();
const router = useRouter();

onMounted(async () => {
	await login();
	await router.push('/profile');
});
</script>

<template>
	<section>
		<h1>Redirecting...</h1>
	</section>
</template>
