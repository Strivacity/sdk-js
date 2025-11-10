<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { FallbackError, type LoginFlowState } from '@strivacity/sdk-core';

const router = useRouter();
const { options, login } = useStrivacity();
const sessionId = ref<string | null>(null);

if (window.location.search !== '') {
	const url = new URL(window.location.href);
	sessionId.value = url.searchParams.get('session_id');

	url.search = '';
	history.replaceState({}, '', url.toString());
}

onMounted(async () => {
	if (options.value.mode === 'redirect') {
		await login();
	} else if (options.value.mode === 'popup') {
		await login();
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
const onClose = () => {
	location.reload();
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
		<h1 v-if="options.mode === 'redirect'">Redirecting...</h1>
		<h1 v-else-if="options.mode === 'popup'">Loading...</h1>
		<Suspense v-else-if="options.mode === 'native'">
			<template #default>
				<StyLoginRenderer
					:widgets="widgets"
					:session-id="sessionId"
					@fallback="onFallback"
					@close="onClose"
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
