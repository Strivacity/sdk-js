<script setup lang="ts">
import { component } from '../components/auth';
</script>

<template>
	<component :is="component" flow-type="login" />
</template>
