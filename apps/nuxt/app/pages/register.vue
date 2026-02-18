<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { FallbackError, type LoginFlowState, type ExtraRequestArgs } from '@strivacity/sdk-core';

const runtimeConfig = useRuntimeConfig();
const router = useRouter();
const { sdk, register } = useStrivacity();
const shortAppId = ref<string | null>(null);
const sessionId = ref<string | null>(null);
const extraParams: ExtraRequestArgs = {
	prompt: 'create',
	loginHint: runtimeConfig.public.LOGIN_HINT,
	acrValues: runtimeConfig.public.ACR_VALUES ? runtimeConfig.public.ACR_VALUES.split(' ') : undefined,
	uiLocales: runtimeConfig.public.UI_LOCALES ? runtimeConfig.public.UI_LOCALES.split(' ') : undefined,
	audiences: runtimeConfig.public.AUDIENCES ? runtimeConfig.public.AUDIENCES.split(' ') : undefined,
};

if (window.location.search !== '') {
	const url = new URL(window.location.href);
	shortAppId.value = url.searchParams.get('short_app_id');
	sessionId.value = url.searchParams.get('session_id');

	url.search = '';
	history.replaceState({}, '', url.toString());
}

onMounted(async () => {
	if (sdk.options.mode === 'redirect') {
		await register(extraParams);
	} else if (sdk.options.mode === 'popup') {
		await register(extraParams);
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
		<template v-else-if="sdk.options.mode === 'embedded'">
			<sty-notifications></sty-notifications>
			<sty-login
				:shortAppId="shortAppId"
				:sessionId="sessionId"
				:params.prop="extraParams"
				@close="onClose"
				@login="onLogin"
				@error="onError($event.detail)"
				@block-ready="onBlockReady($event.detail)"
			></sty-login>
			<sty-language-selector></sty-language-selector>
		</template>
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
