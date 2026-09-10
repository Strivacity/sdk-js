<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useNativeLogin } from '@strivacity/sdk-svelte/client';
	import { FallbackError } from '@strivacity/sdk-core/utils';
	import { widgets } from './widgets';
	import NativeLoginRenderer from './NativeLoginRenderer.svelte';
	import { extraParams } from '../';

	let { flowType }: { flowType: 'login' | 'register' } = $props();

	let sessionId = $state<string | null>(null);
	let language = $state<string | null>(null);

	if (browser && window.location.search !== '') {
		sessionId = page.url.searchParams.get('session_id');
		language = page.url.searchParams.get('language');

		history.replaceState({}, '', page.url.pathname);
	}

	// useNativeLogin() drives a "headless" auth flow: instead of redirecting to a hosted page,
	// the SDK returns a JSON description of the current screen that this component renders itself.
	// It exposes reactive refs and actions to advance the flow, and fires the callbacks below at key points.
	// svelte-ignore state_referenced_locally -- only the session's initial value matters when starting the native flow
	const ctx = useNativeLogin({
		params: {
			...extraParams,
			...(flowType === 'register' ? { prompt: 'create' } : {}),
			// Resume a session started from an entry URL (e.g. a password-reset)
			sessionId,
			language,
		},
		onLogin: async () => {
			// You can handle the login event (e.g. to redirect the user to the profile page)
			// Only called when the app runs in client-side mode (sdk.options.serverSessionUri is not set)
			await goto(resolve('/profile'));
		},
		onClose: () => {
			// You can handle the close event (e.g. to redirect the user to a different page or reload the current page)
			globalThis.location.reload();
		},
		onError: async (error: Error) => {
			// You can handle errors (e.g. to show an error page)
			await goto(`${resolve('/error')}?error=${encodeURIComponent(error.message)}`);
		},
		onFallback: (error: FallbackError) => {
			// Fallback to the hosted journey (e.g. in cases where the native widget or screen is not supported)
			globalThis.location.href = error.url.toString();
		},
		onGlobalMessage: (message) => {
			// You can handle global messages (e.g. to show a toast notification)
			alert(message.text);
		},
	});

	const passwordScreen = $derived.by(() => {
		if (ctx.state.screen !== 'password') {
			return null;
		}

		// Each SDK screen is made up of one or more "forms", and each form holds a flat list of
		// "widgets" (inputs/buttons) identified by id. Here we look those widgets up by hand so we
		// can lay them out with fully custom markup instead of using the generic WidgetRenderer below.

		const passwordForm = ctx.state.forms?.find((form) => form.id === 'password');
		const resetForm = ctx.state.forms?.find((form) => form.id === 'reset');

		return {
			hasResetForm: !!resetForm,
			sectionTitleWidget: passwordForm?.widgets?.find((widget) => widget.id === 'section-title'),
			passwordInputWidget: passwordForm?.widgets?.find((widget) => widget.id === 'password'),
			keepMeLoggedInWidget: passwordForm?.widgets?.find((widget) => widget.id === 'keepMeLoggedIn'),
			submitWidget: passwordForm?.widgets?.find((widget) => widget.id === 'submit'),
			resetSubmitWidget: resetForm?.widgets?.find((widget) => widget.id === 'submit'),
		};
	});
</script>

<!-- No screen yet: the SDK is still fetching the first screen from the auth server -->
{#if ctx.loading || !ctx.state.screen}
	<section>Loading...</section>

	<!-- Custom markup for the 'password' screen instead of the generic renderer below -->
{:else if passwordScreen}
	<section class="login-renderer">
		<form
			data-widget="layout"
			data-type="vertical"
			data-form-id="password"
			onsubmit={async (event) => {
				event.preventDefault();
				await ctx.submitForm('password');
			}}
		>
			<widgets.static formId="password" config={passwordScreen.sectionTitleWidget} />
			<!-- You can add custom elements -->
			<div style="text-align: center">This is a custom text</div>
			<widgets.password formId="password" config={passwordScreen.passwordInputWidget} />
			<widgets.checkbox formId="password" config={passwordScreen.keepMeLoggedInWidget} />
			<!-- You can override widget rendering also -->
			<button
				type="submit"
				disabled={ctx.loading}
				data-widget="submit"
				data-type="button"
				data-variant="primary"
				data-form-id="password"
				data-widget-id="submit"
			>
				Custom button
			</button>
			{#if passwordScreen.hasResetForm}
				<widgets.submit formId="reset" config={passwordScreen.resetSubmitWidget} />
			{/if}
		</form>
	</section>

	<!-- Every other screen: render its layout generically -->
{:else}
	<NativeLoginRenderer layout={ctx.state.layout} />
{/if}
