<script setup lang="ts">
import { type Component, defineComponent, onMounted, h } from 'vue';
import type { RedirectFlow, PopupFlow, Widget } from '@strivacity/sdk-nuxt';
import { injectScript, useStrivacity, useNativeLogin } from '#imports';
import { WidgetRenderer, widgets } from '../components/login';

const issuer = import.meta.env.VITE_ISSUER;
const mode = import.meta.env.VITE_MODE;
const extraParams: Record<string, string | Array<string> | undefined> = {
	loginSessionUri: '/auth/login/session',
	loginHint: import.meta.env.VITE_LOGIN_HINT,
	acrValues: import.meta.env.VITE_ACR_VALUES?.split(' '),
	uiLocales: import.meta.env.VITE_UI_LOCALES?.split(' '),
	audiences: import.meta.env.VITE_AUDIENCES?.split(' '),
};
const { sdk } = useStrivacity();

// NOTE: This demo shows all supported modes side by side
// in your own app, pick the single mode you use and drop the rest
const components: Record<string, Component> = {
	// NOTE: in your own app, keep only the branch matching your `serverSideSession` setting.
	redirect: sdk.options.serverSideSession
		? defineComponent({
				async setup() {
					await navigateTo({ path: '/auth/register', query: extraParams }, { redirectCode: 301, external: true });
				},
			})
		: defineComponent({
				setup() {
					const { register } = useStrivacity<RedirectFlow>();

					onMounted(async () => {
						await register(extraParams);
					});

					return () => h('section', 'Loading...');
				},
			}),

	popup: defineComponent({
		setup() {
			const { register } = useStrivacity<PopupFlow>();

			onMounted(async () => {
				try {
					await register(extraParams);
					globalThis.location.href = '/profile';
				} catch (error) {
					globalThis.location.href = `/error?error_description=${encodeURIComponent(error.message)}`;
				}
			});

			return () => h('section', 'Loading...');
		},
	}),

	embedded: defineComponent({
		setup() {
			// NOTE: Load search params from URL from entry redirect
			const searchParams = new URLSearchParams(globalThis?.window?.location.search);
			const sessionId = ref(searchParams.get('session_id'));
			const shortAppId = ref(searchParams.get('short_app_id'));
			const language = ref(searchParams.get('language') ?? globalThis.navigator?.language);

			const onLogin = async () => {
				globalThis.location.href = '/profile';
			};
			const onClose = () => {
				globalThis.location.reload();
			};
			const onError = (errorOrEvent: Error | CustomEvent<string>) => {
				const message = errorOrEvent instanceof Error ? errorOrEvent.message : errorOrEvent.detail;
				globalThis.location.href = `/error?error=${encodeURIComponent(message)}`;
			};

			// NOTE: Load components bundle script
			injectScript('sty-components', `${issuer}/assets/components/bundle.js`);

			return () =>
				h('section', [
					h('sty-notifications'),
					h('sty-login', {
						'.params': { ...extraParams, prompt: 'create' },
						'.sessionId': sessionId.value,
						'.shortAppId': shortAppId.value,
						'.lang': language.value,
						onLogin,
						onClose,
						onError,
					}),
					h('sty-language-selector'),
				]);
		},
	}),

	native: defineComponent({
		setup() {
			const searchParams = new URLSearchParams(globalThis?.window?.location.search);
			const ctx = useNativeLogin({
				params: {
					...extraParams,
					prompt: 'create',
					sessionId: searchParams.get('session_id'),
					language: searchParams.get('language'),
				},
				onLogin: async () => {
					globalThis.location.href = '/profile';
				},
				onClose: () => {
					globalThis.location.reload();
				},
				onError: async (error) => {
					globalThis.location.href = `/error?error=${encodeURIComponent(error.message)}`;
				},
				onFallback: (error) => {
					globalThis.location.href = error.url.toString();
				},
				onGlobalMessage: async (message) => {
					alert(message.text);
				},
			});

			return () => {
				if (ctx.loading.value || !ctx.state.value.screen) {
					return h('section', h('p', 'Loading...'));
				}

				return h(
					'section',
					{ class: 'login-renderer' },
					h(
						widgets.layout,
						{
							formId: (ctx.state.value.layout?.items?.[0] as Widget | null)?.formId,
							type: ctx.state.value.layout?.type,
							tag: 'form',
						},
						() =>
							h(WidgetRenderer, {
								items: ctx.state.value.layout?.items,
							}),
					),
				);
			};
		},
	}),
};
</script>

<template>
	<component :is="components[mode]" />
</template>
