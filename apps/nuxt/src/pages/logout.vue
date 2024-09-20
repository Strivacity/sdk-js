<script setup lang="ts">
const { isAuthenticated, logout } = useStrivacity();
const router = useRouter();

onMounted(async () => {
	if (isAuthenticated.value) {
		await logout();
	} else {
		await router.push('/');
	}
});
</script>

<template>
	<section>
		<h1>Logging out...</h1>
	</section>
</template>
