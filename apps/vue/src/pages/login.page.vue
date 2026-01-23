<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { FallbackError, useStrivacity, type ExtraRequestArgs, type LoginFlowState } from '@strivacity/sdk-vue';
import { widgets } from '../components/widgets';

const router = useRouter();
const { sdk, login } = useStrivacity();
const sessionId = ref<string | null>(null);
const extraParams: ExtraRequestArgs = {
	loginHint: import.meta.env.VITE_LOGIN_HINT,
	acrValues: import.meta.env.VITE_ACR_VALUES ? import.meta.env.VITE_ACR_VALUES?.split(' ') : undefined,
	uiLocales: import.meta.env.VITE_UI_LOCALES ? import.meta.env.VITE_UI_LOCALES?.split(' ') : undefined,
	audiences: import.meta.env.VITE_AUDIENCES ? import.meta.env.VITE_AUDIENCES?.split(' ') : undefined,
};

if (location.search !== '') {
	const url = new URL(window.location.href);
	sessionId.value = url.searchParams.get('session_id');

	url.search = '';
	history.replaceState({}, '', url.toString());
}

onMounted(async () => {
	if (sdk.options.mode === 'redirect') {
		await login(extraParams);
	} else if (sdk.options.mode === 'popup') {
		await login(extraParams);
		await router.push('/profile');
	}
});

const onLogin = async () => {
	await router.push('/profile');
};
const onFallback = (error: FallbackError) => {
	if (error.url) {
		location.href = error.url.toString();
	} else {
		alert(error);
	}
};
const onClose = () => {
	location.reload();
};
const onError = (error: string) => {
	alert(error);
};
const onGlobalMessage = (message: string) => {
	alert(message);
};
const onBlockReady = (_events: { previousState: LoginFlowState; state: LoginFlowState }) => {
	// You can handle block ready events here
};
</script>

<template>
	<section>
		<h1 v-if="sdk.options.mode === 'redirect'">Redirecting...</h1>
		<h1 v-else-if="sdk.options.mode === 'popup'">Loading...</h1>
		<Suspense v-else-if="sdk.options.mode === 'native'">
			<template #default>
				<StyLoginRenderer
					:widgets="widgets"
					:session-id="sessionId"
					:params="extraParams"
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
