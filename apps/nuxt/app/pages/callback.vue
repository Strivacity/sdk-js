<script setup lang="ts">
import Server from '../components/callback/Server.vue';
import Client from '../components/callback/Client.vue';

const { sdk } = useStrivacity();
</script>

<template>
	<!-- This demo shows both session modes side by side. -->
	<!-- in your own app, keep only the branch matching your `serverSessionUri` setting. -->
	<Server v-if="sdk.options.serverSessionUri" />
	<Client v-else />
</template>
