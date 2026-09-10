<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useNativeLogin } from '@strivacity/sdk-vue';
import { widgets } from './widgets';
import NativeLoginRenderer from './NativeLoginRenderer.vue';
import { extraParams } from '../';

const props = defineProps<{
	flowType: 'login' | 'register';
}>();

const router = useRouter();
const searchParams = new URLSearchParams(globalThis?.window?.location.search);

// useNativeLogin() drives a "headless" auth flow: instead of redirecting to a hosted page,
// the SDK returns a JSON description of the current screen that this component renders itself.
// It exposes reactive refs and actions to advance the flow, and fires the callbacks below at key points.
const ctx = useNativeLogin({
	params: {
		...extraParams,
		...(props.flowType === 'register' ? { prompt: 'create' } : {}),
		// Resume a session started from an entry URL (e.g. a password-reset)
		sessionId: searchParams.get('session_id'),
		language: searchParams.get('language'),
	},
	onLogin: async () => {
		// You can handle the login event (e.g. to redirect the user to the profile page)
		// Only called when the app runs in client-side mode (sdk.options.serverSessionUri is not set)
		await router.push('/profile');
	},
	onClose: () => {
		// You can handle the close event (e.g. to redirect the user to a different page or reload the current page)
		globalThis.location.reload();
	},
	onError: async (error) => {
		// You can handle errors (e.g. to show an error page)
		await router.push(`/error?error=${encodeURIComponent(error.message)}`);
	},
	onFallback: (error) => {
		// Fallback to the hosted journey (e.g. in cases where the native widget or screen is not supported)
		globalThis.location.href = error.url.toString();
	},
	onGlobalMessage: async (message) => {
		// You can handle global messages (e.g. to show a toast notification)
		alert(message.text);
	},
});

const passwordScreen = computed(() => {
	if (ctx.state.value.screen !== 'password') {
		return null;
	}

	// Each SDK screen is made up of one or more "forms", and each form holds a flat list of
	// "widgets" (inputs/buttons) identified by id. Here we look those widgets up by hand so we
	// can lay them out with fully custom markup instead of using the generic WidgetRenderer below.

	const passwordForm = ctx.state.value.forms?.find((form) => form.id === 'password');
	const resetForm = ctx.state.value.forms?.find((form) => form.id === 'reset');

	return {
		hasResetForm: !!resetForm,
		sectionTitleWidget: passwordForm?.widgets?.find((widget) => widget.id === 'section-title'),
		passwordInputWidget: passwordForm?.widgets?.find((widget) => widget.id === 'password'),
		keepMeLoggedInWidget: passwordForm?.widgets?.find((widget) => widget.id === 'keepMeLoggedIn'),
		submitWidget: passwordForm?.widgets?.find((widget) => widget.id === 'submit'),
		resetSubmitWidget: resetForm?.widgets?.find((widget) => widget.id === 'submit'),
	};
});

async function onPasswordSubmit() {
	await ctx.submitForm('password');
}
</script>

<template>
	<!-- No screen yet: the SDK is still fetching the first screen from the auth server -->
	<section v-if="!ctx.state.value.screen">Loading...</section>

	<!-- Custom markup for the 'password' screen instead of the generic renderer below -->
	<section v-else-if="passwordScreen" class="login-renderer">
		<form data-widget="layout" data-type="vertical" data-form-id="password" @submit.prevent="onPasswordSubmit">
			<component :is="widgets.static" formId="password" :config="passwordScreen.sectionTitleWidget" />
			<!-- You can add custom elements -->
			<div style="text-align: center">This is a custom text</div>
			<component :is="widgets.password" formId="password" :config="passwordScreen.passwordInputWidget" />
			<component :is="widgets.checkbox" formId="password" :config="passwordScreen.keepMeLoggedInWidget" />
			<component :is="widgets.submit" formId="password" :config="passwordScreen.submitWidget" />
			<component v-if="passwordScreen.hasResetForm" :is="widgets.submit" formId="reset" :config="passwordScreen.resetSubmitWidget" />
		</form>
	</section>

	<!-- Every other screen: render its layout generically -->
	<NativeLoginRenderer v-else :layout="ctx.state.value.layout" />
</template>
