<script setup lang="ts">
import { computed } from 'vue';
import { useStrivacity } from '#imports';

const { isAuthenticated, idTokenClaims } = useStrivacity();

const name = computed(() => (isAuthenticated.value ? `${idTokenClaims.value?.given_name ?? ''} ${idTokenClaims.value?.family_name ?? ''}`.trim() : null));
</script>

<template>
	<header>
		<div>
			<ClientOnly>
				<strong v-if="isAuthenticated">Welcome, {{ name }}!</strong>
			</ClientOnly>
		</div>
		<div>
			<NuxtLink to="/" data-button="home">Home</NuxtLink>
			<ClientOnly>
				<template v-if="isAuthenticated">
					<NuxtLink to="/profile" data-button="profile">Profile</NuxtLink>
					<NuxtLink to="/revoke" data-button="revoke">Revoke</NuxtLink>
					<NuxtLink to="/logout" data-button="logout">Logout</NuxtLink>
				</template>
				<template v-else>
					<NuxtLink to="/login" data-button="login">Login</NuxtLink>
					<NuxtLink to="/register" data-button="register">Register</NuxtLink>
				</template>
			</ClientOnly>
		</div>
	</header>
	<slot />
</template>
