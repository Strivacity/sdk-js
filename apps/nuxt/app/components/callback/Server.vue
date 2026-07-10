<script setup lang="ts">
const route = useRoute();

await navigateTo({ path: '/auth/callback', query: route.query }, { redirectCode: 301, external: true });
</script>

<template></template>
