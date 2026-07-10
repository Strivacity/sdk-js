<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { injectScript } from '@strivacity/sdk-vue';
import { extraParams } from '../';

// "Embedded" mode doesn't use any SDK composable directly. Instead the Strivacity auth server
// ships a bundle of pre-built, framework-agnostic web components (custom elements) that render
// the whole login UI inside <sty-login>. This component just configures and mounts
// that element and reacts to the DOM events it dispatches.

const props = defineProps<{
	flowType: 'login' | 'register';
}>();

const router = useRouter();
const searchParams = new URLSearchParams(globalThis?.window?.location.search);
const params = computed(() => (props.flowType === 'register' ? { ...extraParams, prompt: 'create' } : extraParams));
// Resume a session started from an entry URL (e.g. a password-reset)
const sessionId = searchParams.get('session_id');
const shortAppId = searchParams.get('short_app_id');
const lang = searchParams.get('language') ?? globalThis.navigator?.language;

// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
// custom element definitions from the auth server
injectScript('sty-components', `${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);

async function onLogin() {
	// Fired by <sty-login> once the user completes the flow
	await router.push('/profile');
}

function onClose() {
	// Fired when the user finishes the flow with a close action (e.g. close button)
	globalThis.location.reload();
}

async function onError(event: CustomEvent) {
	// Fired when the flow can't continue (e.g. network/config problem)
	await router.push(`/error?error=${encodeURIComponent(event.detail)}`);
}
</script>

<template>
	<section class="login-renderer">
		<sty-notifications></sty-notifications>
		<sty-login
			:params.prop="params"
			:sessionId="sessionId"
			:shortAppId="shortAppId"
			:lang="lang"
			@login="onLogin"
			@close="onClose"
			@error="onError"
		></sty-login>
		<sty-language-selector></sty-language-selector>
	</section>
</template>
