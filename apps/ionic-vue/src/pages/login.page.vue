<!-- eslint-disable no-async-promise-executor, @typescript-eslint/no-misused-promises -->
<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler } from '@strivacity/sdk-core/utils/handlers';
import { FallbackError, useStrivacity, type LoginFlowState } from '@strivacity/sdk-vue';
import { widgets } from '../components/widgets';

const router = useRouter();
const { sdk, login } = useStrivacity();
const sessionId = ref<string | null>(null);

if (location.search !== '') {
	const url = new URL(window.location.href);
	sessionId.value = url.searchParams.get('session_id');

	url.search = '';
	history.replaceState({}, '', url.toString());
}

onMounted(async () => {
	if (sdk.options.mode === 'redirect') {
		await login();

		if (Capacitor.getPlatform() !== 'web') {
			const params = (await sdk.options.callbackHandler!(sdk.options.redirectUri, sdk.options.responseMode || 'fragment')) as Record<string, string>;
			await sdk.tokenExchange(params);
			await router.push('/profile');
		}
	} else if (sdk.options.mode === 'popup') {
		await login();
		await router.push('/profile');
	}
});

const onLogin = async () => {
	await router.push('/profile');
};
const onFallback = async (error: FallbackError) => {
	if (error.url) {
		if (Capacitor.getPlatform() === 'web') {
			return redirectUrlHandler(error.url.toString());
		} else {
			await InAppBrowser.openInWebView({ url: error.url.toString(), options: DefaultWebViewOptions });

			const params = await new Promise<Record<string, string>>(async (resolve, reject) => {
				let navigationListener: PluginListenerHandle | null = null;
				let finishListener: PluginListenerHandle | null = null;
				let userCancelled = true;

				const cleanupListeners = async () => {
					if (navigationListener) {
						await navigationListener.remove();
						navigationListener = null;
					}

					if (finishListener) {
						await finishListener.remove();
						finishListener = null;
					}
				};

				try {
					navigationListener = await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
						const navigatedUrl = event.url;

						if (navigatedUrl && navigatedUrl.startsWith(sdk.options.redirectUri)) {
							try {
								const urlInstance = new URL(navigatedUrl);
								const dataString = sdk.options.responseMode === 'query' ? urlInstance.search : urlInstance.hash;
								const params = Object.fromEntries(new URLSearchParams(dataString.slice(1)));

								userCancelled = false;
								await InAppBrowser.close();
								resolve(params);
							} catch (error) {
								await InAppBrowser.close();
								reject(error);
							}
						}
					});
					finishListener = await InAppBrowser.addListener('browserClosed', async () => {
						await cleanupListeners();

						if (userCancelled) {
							reject(new Error('InAppBrowser flow cancelled by user.'));
						}
					});
				} catch (error) {
					reject(error);
				}
			});

			if (params.session_id) {
				await router.push(`/callback?session_id=${params.session_id}`);
			} else {
				await sdk.tokenExchange(params);
				await router.push('/profile');
			}
		}
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
