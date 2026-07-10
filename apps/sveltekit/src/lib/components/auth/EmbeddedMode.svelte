<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ExtraRequestArgs } from '@strivacity/sdk-core';

	let { params, shortAppId, sessionId, language }: { params: ExtraRequestArgs; shortAppId: string | null; sessionId: string | null; language: string | null } = $props();

	// NOTE: Load components bundle script
	void import(/* @vite-ignore */ `${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);
</script>

<sty-notifications></sty-notifications>
<sty-login
	{params}
	{shortAppId}
	{sessionId}
	lang={language}
	onclose={() => globalThis.location.reload()}
	onlogin={() => goto(resolve('/profile'))}
	onerror={(event: CustomEvent) => goto(`${resolve('/error')}?error=${encodeURIComponent(event.detail)}`)}
></sty-login>
<sty-language-selector></sty-language-selector>
