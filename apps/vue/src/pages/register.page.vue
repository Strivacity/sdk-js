<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { FallbackError, useStrivacity } from '@strivacity/sdk-vue';
import { widgets } from '../components/widgets';

const router = useRouter();
const { options, register } = useStrivacity();
const sessionId = ref<string | null>(null);
const url = new URL(window.location.href);
sessionId.value = url.searchParams.get('session_id');

url.search = '';
history.replaceState({}, '', url.toString());

onMounted(async () => {
	if (options.value.mode === 'redirect') {
		await register();
	} else if (options.value.mode === 'popup') {
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
	}
};
const onError = (error: string) => {
	// eslint-disable-next-line no-console
	console.error(`Error: ${error}`);
};
const onGlobalMessage = (message: string) => {
	alert(message);
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
					@login="onLogin"
					@error="onError"
					@global-message="onGlobalMessage"
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
