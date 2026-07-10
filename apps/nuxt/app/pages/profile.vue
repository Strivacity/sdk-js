<script setup lang="ts">
import Session from '../components/profile/Session.vue';

definePageMeta({
	middleware: ['auth'],
});
</script>

<template>
	<Session />
</template>
