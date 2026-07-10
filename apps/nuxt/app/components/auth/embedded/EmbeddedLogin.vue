<script setup lang="ts">
import { computed, ref } from 'vue';
import { injectScript } from '#imports';
import { extraParams } from '../';

// "Embedded" mode doesn't use any SDK composable directly. Instead the Strivacity auth server
// ships a bundle of pre-built, framework-agnostic web components (custom elements) that render
// the whole login UI inside <sty-login>. This component just configures and mounts
// that element and reacts to the DOM events it dispatches.

const props = defineProps<{
	flowType: 'login' | 'register';
}>();

const issuer = import.meta.env.VITE_ISSUER;
const searchParams = new URLSearchParams(globalThis?.window?.location.search);
const params = computed(() => (props.flowType === 'register' ? { ...extraParams, prompt: 'create' } : extraParams));
// Resume a session started from an entry URL (e.g. a password-reset)
const sessionId = ref(searchParams.get('session_id'));
const shortAppId = ref(searchParams.get('short_app_id'));
const language = ref(searchParams.get('language') ?? globalThis.navigator?.language);

// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
// custom element definitions from the auth server
injectScript('sty-components', `${issuer}/assets/components/bundle.js`);

function onLogin() {
	// Fired by <sty-login> once the user completes the flow
	globalThis.location.href = '/profile';
}

function onClose() {
	// Fired when the user finishes the flow with a close action (e.g. close button)
	globalThis.location.reload();
}

function onError(errorOrEvent: Error | CustomEvent<string>) {
	// Fired when the flow can't continue (e.g. network/config problem)
	const message = errorOrEvent instanceof Error ? errorOrEvent.message : errorOrEvent.detail;
	globalThis.location.href = `/error?error=${encodeURIComponent(message)}`;
}
</script>

<template>
	<section class="login-renderer">
		<sty-notifications></sty-notifications>
		<sty-login
			:params.prop="params"
			:sessionId="sessionId"
			:shortAppId="shortAppId"
			:lang="language"
			@login="onLogin"
			@close="onClose"
			@error="onError"
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
