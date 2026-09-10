<script setup lang="ts">
const { logout } = useStrivacity();

onMounted(async () => {
	await logout();
});
</script>

<template></template>
