<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { extraParams } from '../';

	// "Embedded" mode doesn't use any SDK composable directly. Instead the Strivacity auth server
	// ships a bundle of pre-built, framework-agnostic web components (custom elements) that render
	// the whole login UI inside <sty-login>. This component just configures and mounts
	// that element and reacts to the DOM events it dispatches.

	let { flowType }: { flowType: 'login' | 'register' } = $props();

	// Resume a session started from an entry URL (e.g. a password-reset)
	let sessionId = $state<string | null>(null);
	let shortAppId = $state<string | null>(null);
	let language = $state<string | null>(null);

	if (browser && window.location.search !== '') {
		sessionId = page.url.searchParams.get('session_id');
		shortAppId = page.url.searchParams.get('short_app_id');
		language = page.url.searchParams.get('language');

		history.replaceState({}, '', page.url.pathname);
	}

	const params = $derived(flowType === 'register' ? { ...extraParams, prompt: 'create' } : extraParams);

	// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
	// custom element definitions from the auth server
	void import(/* @vite-ignore */ `${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);
</script>

<section class="login-renderer">
	<sty-notifications></sty-notifications>
	<sty-login
		{params}
		{sessionId}
		{shortAppId}
		lang={language ?? globalThis.navigator?.language}
		onclose={() => globalThis.location.reload()}
		onlogin={() => goto(resolve('/profile'))}
		onerror={(event: CustomEvent) => goto(`${resolve('/error')}?error=${encodeURIComponent(event.detail)}`)}
	></sty-login>
	<sty-language-selector></sty-language-selector>
</section>
