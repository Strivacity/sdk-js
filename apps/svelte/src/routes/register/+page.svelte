<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { useStrivacity, StyLoginRenderer, type LoginFlowState } from '@strivacity/sdk-svelte';
	import { FallbackError, type ExtraRequestArgs } from '@strivacity/sdk-core';
	import { widgets } from '../../components/widgets';

	const { sdk, register } = useStrivacity();
	let sessionId = $state<string | null>(null);

	const extraParams: ExtraRequestArgs = {
		prompt: 'create',
		loginHint: import.meta.env.VITE_LOGIN_HINT,
		acrValues: import.meta.env.VITE_ACR_VALUES ? import.meta.env.VITE_ACR_VALUES.split(' ') : undefined,
		uiLocales: import.meta.env.VITE_UI_LOCALES ? import.meta.env.VITE_UI_LOCALES.split(' ') : undefined,
		audiences: import.meta.env.VITE_AUDIENCES ? import.meta.env.VITE_AUDIENCES.split(' ') : undefined,
	};

	if (browser && window.location.search !== '') {
		sessionId = $page.url.searchParams.get('session_id');

		history.replaceState({}, '', $page.url.pathname);
	}

	onMount(async () => {
		if (!browser) {
			return;
		}

		if (sdk.options.mode === 'redirect') {
			await register(extraParams);
		} else if (sdk.options.mode === 'popup') {
			await register(extraParams);
			await goto(resolve('/profile'));
		}
	});

	const onLogin = async () => {
		await goto(resolve('/profile'));
	};

	const onFallback = (error: FallbackError) => {
		if (error.url) {
			location.href = error.url.toString();
		} else {
			alert(error);
		}
	};

	const onClose = () => {
		location.reload();
	};

	const onError = (error: string) => {
		alert(error);
	};

	const onGlobalMessage = (message: string) => {
		alert(message);
	};

	const onBlockReady = (_events: { previousState: LoginFlowState; state: LoginFlowState }) => {
		// You can handle block ready events here
	};
</script>

<section>
	{#if sdk.options.mode === 'redirect'}
		<h1>Redirecting...</h1>
	{:else if sdk.options.mode === 'popup'}
		<h1>Loading...</h1>
	{:else if sdk.options.mode === 'native'}
		<StyLoginRenderer
			params={extraParams}
			{widgets}
			{sessionId}
			onfallback={onFallback}
			onclose={onClose}
			onlogin={onLogin}
			onerror={onError}
			onglobalmessage={onGlobalMessage}
			onblockready={onBlockReady}
		/>
	{/if}
</section>

<style>
	:global(.login-renderer) {
		margin: 0 auto;
		width: 360px;
	}
</style>
