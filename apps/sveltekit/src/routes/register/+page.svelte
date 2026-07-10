<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { sdkOptions } from '$lib/options';
	import type { ExtraRequestArgs } from '@strivacity/sdk-core';
	import RedirectMode from '$lib/components/auth/RedirectMode.svelte';
	import PopupMode from '$lib/components/auth/PopupMode.svelte';
	import EmbeddedMode from '$lib/components/auth/EmbeddedMode.svelte';
	import NativeMode from '$lib/components/auth/NativeMode.svelte';

	let shortAppId = $state<string | null>(null);
	let sessionId = $state<string | null>(null);
	let language = $state<string | null>(null);

	const extraParams: ExtraRequestArgs = {
		prompt: 'create',
		loginSessionUri: '/auth/login/session',
		loginHint: import.meta.env.VITE_LOGIN_HINT,
		acrValues: import.meta.env.VITE_ACR_VALUES ? import.meta.env.VITE_ACR_VALUES.split(' ') : undefined,
		uiLocales: import.meta.env.VITE_UI_LOCALES ? import.meta.env.VITE_UI_LOCALES.split(' ') : undefined,
		audiences: import.meta.env.VITE_AUDIENCES ? import.meta.env.VITE_AUDIENCES.split(' ') : undefined,
	};

	if (browser && window.location.search !== '') {
		shortAppId = page.url.searchParams.get('short_app_id');
		sessionId = page.url.searchParams.get('session_id');
		language = page.url.searchParams.get('language');

		history.replaceState({}, '', page.url.pathname);
	}
</script>

<section>
	<!-- NOTE: This demo shows all supported modes side by side -->
	<!-- in your own app, pick the single mode you use and drop the rest -->
	{#if sdkOptions.mode === 'redirect'}
		<RedirectMode action="register" params={extraParams} />
	{:else if sdkOptions.mode === 'popup'}
		<PopupMode action="register" params={extraParams} />
	{:else if sdkOptions.mode === 'embedded'}
		<EmbeddedMode params={extraParams} {shortAppId} {sessionId} {language} />
	{:else if sdkOptions.mode === 'native'}
		<NativeMode params={extraParams} {sessionId} {language} />
	{/if}
</section>
