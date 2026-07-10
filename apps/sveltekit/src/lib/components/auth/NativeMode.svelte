<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useNativeLogin } from '@strivacity/sdk-svelte/client';
	import { FallbackError, type ExtraRequestArgs, type Widget } from '@strivacity/sdk-core';
	import { WidgetRenderer, widgets } from '../widgets';

	let { params, sessionId, language }: { params: ExtraRequestArgs; sessionId: string | null; language: string | null } = $props();

	const LayoutComponent = widgets.layout;

	const ctx = useNativeLogin({
		// svelte-ignore state_referenced_locally -- only the session's initial value matters when starting the native flow
		params: { ...params, sessionId, language },
		onLogin: async () => {
			await goto(resolve('/profile'));
		},
		onFallback: (error: FallbackError) => {
			globalThis.location.href = error.url.toString();
		},
		onClose: () => {
			globalThis.location.reload();
		},
		onError: async (error: Error) => {
			await goto(`${resolve('/error')}?error=${encodeURIComponent(error.message)}`);
		},
		onGlobalMessage: (message) => {
			alert(message.text);
		},
	});
</script>

{#if ctx.loading || !ctx.state.screen}
	<h1>Loading...</h1>
{:else}
	<div class="login-renderer">
		<LayoutComponent formId={(ctx.state.layout?.items?.[0] as Widget | undefined)?.formId} type={ctx.state.layout?.type} tag="form">
			<WidgetRenderer items={ctx.state.layout?.items} />
		</LayoutComponent>
	</div>
{/if}
