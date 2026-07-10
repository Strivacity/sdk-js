<script setup lang="ts">
import Server from '../components/revoke/Server.vue';
import Client from '../components/revoke/Client.vue';

const { sdk } = useStrivacity();
</script>

<template>
	<!-- NOTE: This demo shows both session modes side by side. -->
	<!-- in your own app, keep only the branch matching your `serverSideSession` setting. -->
	<Server v-if="sdk.options.serverSideSession" />
	<Client v-else />
</template>
