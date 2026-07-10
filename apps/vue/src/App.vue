<script setup lang="ts">
import { useStrivacity } from '@strivacity/sdk-vue';
import { computed } from 'vue';
import { RouterLink, RouterView } from 'vue-router';

const { sdk, isAuthenticated, idTokenClaims } = useStrivacity();

async function init() {
	if (!sdk.options.serverSessionUri) {
		return;
	}

	// This demo shows both session modes side by side.
	// Only called when the app runs in server-side mode (sdk.options.serverSessionUri is set)
	const response = await fetch('/auth/session', { credentials: 'include' });

	if (response.ok) {
		sdk.updateSession(await response.json());
	}
}

await init();

const name = computed(() => (isAuthenticated.value ? `${idTokenClaims.value?.given_name ?? ''} ${idTokenClaims.value?.family_name ?? ''}`.trim() : null));
</script>

<template>
	<header>
		<div>
			<strong v-if="isAuthenticated">Welcome, {{ name }}!</strong>
		</div>
		<div>
			<RouterLink to="/" data-button="home">Home</RouterLink>
			<template v-if="isAuthenticated">
				<RouterLink to="/profile" data-button="profile">Profile</RouterLink>
				<RouterLink to="/revoke" data-button="revoke">Revoke</RouterLink>
				<RouterLink to="/logout" data-button="logout">Logout</RouterLink>
			</template>
			<template v-else>
				<RouterLink to="/login" data-button="login">Login</RouterLink>
				<RouterLink to="/register" data-button="register">Register</RouterLink>
			</template>
		</div>
	</header>
	<RouterView />
</template>
