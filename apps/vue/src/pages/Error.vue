<script setup lang="ts">
const searchParams = new URLSearchParams(window.location.search);
const message = searchParams.get('error_description') || searchParams.get('error') || searchParams.get('message');
</script>

<template>
	<section>
		<h2>Something went wrong</h2>
		<p v-if="message" class="profile-muted">{{ decodeURIComponent(message) }}</p>
	</section>
</template>
