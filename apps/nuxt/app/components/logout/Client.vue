<script setup lang="ts">
const { logout } = useStrivacity();

onMounted(async () => {
	await logout({ postLogoutRedirectUri: new URL('/', globalThis.location.origin).toString() });
});
</script>

<template></template>
