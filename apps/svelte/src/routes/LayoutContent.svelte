<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const { state } = useStrivacity();
	let name = $derived(`${state.idTokenClaims?.given_name ?? ''} ${state.idTokenClaims?.family_name ?? ''}`);
</script>

<div id="app">
	<header>
		<div>
			{#if state.loading}
				<strong>Loading...</strong>
			{:else if state.isAuthenticated}
				<strong>Welcome, {name}!</strong>
			{/if}
		</div>
		<div>
			{#if !state.loading}
				<a href={resolve('/')} data-button="home">Home</a>
				{#if state.isAuthenticated}
					<a href={resolve('/profile')} data-button="profile">Profile</a>
					<a href={resolve('/revoke')} data-button="revoke">Revoke</a>
					<a href={resolve('/logout')} data-button="logout">Logout</a>
				{:else}
					<a href={resolve('/login')} data-button="login">Login</a>
					<a href={resolve('/register')} data-button="register">Register</a>
				{/if}
			{/if}
		</div>
	</header>
	<main>
		{@render children()}
	</main>
</div>

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

	main {
		padding: 1rem;
	}
</style>
