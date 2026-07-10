<script setup lang="ts">
import { type Component, defineComponent, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import type { RedirectFlow, PopupFlow, Widget } from '@strivacity/sdk-vue';
import { injectScript, useStrivacity, useNativeLogin } from '@strivacity/sdk-vue';
import { WidgetRenderer, widgets } from '../components/login';

const issuer = import.meta.env.VITE_ISSUER;
const mode = import.meta.env.VITE_MODE;
const extraParams: Record<string, string | Array<string> | undefined> = {
	loginHint: import.meta.env.VITE_LOGIN_HINT,
	acrValues: import.meta.env.VITE_ACR_VALUES?.split(' '),
	uiLocales: import.meta.env.VITE_UI_LOCALES?.split(' '),
	audiences: import.meta.env.VITE_AUDIENCES?.split(' '),
};

// NOTE: This demo shows all supported modes side by side
// in your own app, pick the single mode you use and drop the rest
const components: Record<string, Component> = {
	redirect: defineComponent({
		setup() {
			const { login } = useStrivacity<RedirectFlow>();

			onMounted(async () => {
				await login(extraParams);
			});

			return () => h('section', 'Loading...');
		},
	}),

	popup: defineComponent({
		setup() {
			const { login } = useStrivacity<PopupFlow>();
			const router = useRouter();

			onMounted(async () => {
				try {
					await login(extraParams);
					await router.push('/profile');
				} catch (error) {
					await router.push(`/error?error_description=${encodeURIComponent(error.message)}`);
				}
			});

			return () => h('section', 'Loading...');
		},
	}),

	embedded: defineComponent({
		setup() {
			const router = useRouter();
			const searchParams = new URLSearchParams(globalThis?.window?.location.search);

			const sessionId = searchParams.get('session_id');
			const shortAppId = searchParams.get('short_app_id');
			const language = searchParams.get('language') ?? globalThis.navigator?.language;

			const onLogin = async () => {
				await router.push('/profile');
			};
			const onClose = () => {
				globalThis.location.reload();
			};
			const onError = async (errorOrEvent: Error | CustomEvent<string>) => {
				const message = errorOrEvent instanceof Error ? errorOrEvent.message : errorOrEvent.detail;
				await router.push(`/error?error=${encodeURIComponent(message)}`);
			};

			// NOTE: Load components bundle script
			injectScript('sty-components', `${issuer}/assets/components/bundle.js`);

			return () =>
				h('section', [
					h('sty-notifications'),
					h('sty-login', {
						sessionId: sessionId,
						shortAppId: shortAppId,
						lang: language,
						'.params': extraParams,
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
			const router = useRouter();
			const searchParams = new URLSearchParams(globalThis?.window?.location.search);
			const ctx = useNativeLogin({
				params: {
					...extraParams,
					sessionId: searchParams.get('session_id'),
					language: searchParams.get('language'),
				},
				onLogin: async () => {
					await router.push('/profile');
				},
				onClose: () => {
					globalThis.location.reload();
				},
				onError: async (error) => {
					await router.push(`/error?error=${encodeURIComponent(error.message)}`);
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

				// NOTE: You can override the password screen
				if (ctx.state.value.screen === 'password') {
					const hasResetForm = ctx.state.value.forms?.some((f) => f.id === 'reset');
					const sectionTitleWidget = ctx.state.value.forms?.find((f) => f.id === 'password')?.widgets?.find((w) => w.id === 'section-title');
					const passwordInputWidget = ctx.state.value.forms?.find((f) => f.id === 'password')?.widgets?.find((w) => w.id === 'password');
					const keepMeLoggedInWidget = ctx.state.value.forms?.find((f) => f.id === 'password')?.widgets?.find((w) => w.id === 'keepMeLoggedIn');
					const resetSubmitWidget = ctx.state.value.forms?.find((f) => f.id === 'reset')?.widgets?.find((w) => w.id === 'submit');

					return h(
						'section',
						{ class: 'login-renderer' },
						h(
							'form',
							{
								'data-widget': 'layout',
								'data-type': 'vertical',
								'data-form-id': 'password',
								onSubmit: async (event: Event) => {
									event.preventDefault();
									await ctx.submitForm('password');
								},
							},
							[
								h(widgets.static, { formId: 'password', config: sectionTitleWidget }),
								h(widgets.password, { formId: 'password', config: passwordInputWidget }),
								h(widgets.checkbox, { formId: 'password', config: keepMeLoggedInWidget }),
								// NOTE: You can override widget rendering also
								h(
									'button',
									{
										type: 'submit',
										disabled: ctx.loading.value,
										'data-widget': 'submit',
										'data-type': 'button',
										'data-variant': 'primary',
										'data-form-id': 'password',
										'data-widget-id': 'submit',
									},
									'Custom button',
								),
								hasResetForm ? h(widgets.submit, { formId: 'reset', config: resetSubmitWidget }) : null,
							],
						),
					);
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
