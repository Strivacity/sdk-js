<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte/client';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const ctx = useStrivacity();
	let name = $derived(`${ctx.idTokenClaims?.given_name ?? ''} ${ctx.idTokenClaims?.family_name ?? ''}`);
</script>

<div id="app">
	<header>
		<div>
			{#if ctx.loading}
				<strong>Loading...</strong>
			{:else if ctx.isAuthenticated}
				<strong>Welcome, {name}!</strong>
			{/if}
		</div>
		<div>
			{#if !ctx.loading}
				<a href={resolve('/')} data-button="home">Home</a>
				{#if ctx.isAuthenticated}
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
	@import '@strivacity/common/styles/globals.css';
</style>
