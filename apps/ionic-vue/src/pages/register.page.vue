<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { FallbackError, useStrivacity, type LoginFlowState } from '@strivacity/sdk-vue';
import { widgets } from '../components/widgets';

const router = useRouter();
const { sdk, register } = useStrivacity();
const sessionId = ref<string | null>(null);

if (window.location.search !== '') {
	const url = new URL(window.location.href);
	sessionId.value = url.searchParams.get('session_id');

	url.search = '';
	history.replaceState({}, '', url.toString());
}

onMounted(async () => {
	if (sdk.options.mode === 'redirect') {
		await register();

		if (Capacitor.getPlatform() !== 'web') {
			await sdk.tokenExchange((await sdk.options.callbackHandler!(sdk.options.redirectUri, sdk.options.responseMode || 'fragment')) as Record<string, string>);
		}
	} else if (sdk.options.mode === 'popup') {
		await register();
		await router.push('/profile');
	}
});

const onLogin = async () => {
	await router.push('/profile');
};
const onFallback = (error: FallbackError) => {
	if (error.url) {
		// eslint-disable-next-line no-console
		console.log(`Fallback: ${error.url}`);
		location.href = error.url.toString();
	} else {
		// eslint-disable-next-line no-console
		console.error(`FallbackError without URL: ${error.message}`);
		alert(error);
	}
};
const onError = (error: string) => {
	// eslint-disable-next-line no-console
	console.error(`Error: ${error}`);
	alert(error);
};
const onGlobalMessage = (message: string) => {
	alert(message);
};
const onBlockReady = ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => {
	// eslint-disable-next-line no-console
	console.log('previousState', previousState);
	// eslint-disable-next-line no-console
	console.log('state', state);
};
</script>

<template>
	<section>
		<h1 v-if="sdk.options.mode === 'redirect'">Redirecting...</h1>
		<h1 v-else-if="sdk.options.mode === 'popup'">Loading...</h1>
		<Suspense v-else-if="sdk.options.mode === 'native'">
			<template #default>
				<StyLoginRenderer
					:params="{ prompt: 'create' }"
					:widgets="widgets"
					:session-id="sessionId"
					@fallback="onFallback"
					@login="onLogin"
					@error="onError"
					@global-message="onGlobalMessage"
					@block-ready="onBlockReady"
				/>
			</template>
			<template #fallback>
				<span>Loading...</span>
			</template>
		</Suspense>
	</section>
</template>

<style lang="scss">
.login-renderer {
	margin: 0 auto;
	width: 360px;
}
</style>
