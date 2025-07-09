<script lang="ts" setup>
import { computed } from 'vue';
import { useStrivacity } from '@strivacity/sdk-vue';

const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
const name = computed(() => `${idTokenClaims.value?.given_name ?? ''} ${idTokenClaims.value?.family_name ?? ''}`);
</script>

<template>
	<header>
		<div>
			<strong v-if="loading">Loading...</strong>
			<strong v-if="!loading && isAuthenticated">Welcome, {{ name }}!</strong>
		</div>
		<div>
			<template v-if="!loading">
				<router-link to="/" data-button="home">Home</router-link>
				<template v-if="isAuthenticated">
					<router-link to="/profile" data-button="profile">Profile</router-link>
					<router-link to="/revoke" data-button="revoke">Revoke</router-link>
					<router-link to="/logout" data-button="logout">Logout</router-link>
				</template>
				<template v-else>
					<router-link to="/login" data-button="login">Login</router-link>
					<router-link to="/register" data-button="register">Register</router-link>
				</template>
			</template>
		</div>
	</header>
	<router-view />
</template>

<style>
#app {
	font-family:
		system-ui,
		-apple-system,
		BlinkMacSystemFont,
		'Segoe UI',
		Roboto,
		Oxygen,
		Ubuntu,
		Cantarell,
		'Open Sans',
		'Helvetica Neue',
		sans-serif;
	max-width: 1200px;
	margin: 0 auto;
}

header {
	display: flex;
	align-items: center;
	padding: 1rem;
	border-block-end: 1px solid rgb(0 0 0 / 15%);

	> div {
		display: flex;
		align-items: center;
		gap: 1rem;

		+ div {
			margin-inline-start: auto;
		}
	}
}

section {
	padding: 1rem;
}
</style>
