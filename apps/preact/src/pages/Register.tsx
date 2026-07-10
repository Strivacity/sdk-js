import type { PopupFlow, LoginComponent, Widget } from '@strivacity/sdk-preact';
import { useEffect, useRef, type ComponentType } from 'preact/compat';
import { route } from 'preact-router';
import { useStrivacity, useNativeLogin, injectScript } from '@strivacity/sdk-preact';
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
const components: Record<string, ComponentType> = {
	redirect: function () {
		const { loading, register } = useStrivacity<PopupFlow>();

		useEffect(() => {
			if (loading) {
				return;
			}

			void register(extraParams);
		}, [loading, register]);

		return (
			<section>
				<p>Loading...</p>
			</section>
		);
	},

	popup: function () {
		const { loading, register } = useStrivacity<PopupFlow>();

		useEffect(() => {
			if (loading) {
				return;
			}

			register(extraParams)
				.then(() => {
					route('/profile');
				})
				.catch((error) => {
					route(`/error?error_description=${encodeURIComponent(error)}`);
				});
		}, [loading, register]);

		return (
			<section>
				<p>Loading...</p>
			</section>
		);
	},

	embedded: function () {
		const searchParams = new URLSearchParams(globalThis?.window?.location.search);

		const sessionId = searchParams.get('session_id');
		const shortAppId = searchParams.get('short_app_id');
		const language = searchParams.get('language') ?? globalThis.navigator?.language;
		const loginRef = useRef<LoginComponent>(null);

		useEffect(() => {
			// NOTE: Load components bundle script
			injectScript('sty-components', `${issuer}/assets/components/bundle.js`);
		}, []);

		useEffect(() => {
			const element = loginRef.current;

			if (!element) {
				return;
			}

			element.params = { ...extraParams, prompt: 'create' };
			element.sessionId = sessionId;
			element.shortAppId = shortAppId;
			element.lang = language;

			const onLogin = () => {
				route('/profile');
			};
			const onClose = () => {
				globalThis.location.reload();
			};
			const onError = (event: Event) => {
				route(`/error?error=${encodeURIComponent((event as CustomEvent<string>).detail)}`);
			};

			element.addEventListener('login', onLogin);
			element.addEventListener('close', onClose);
			element.addEventListener('error', onError);

			return () => {
				element.removeEventListener('login', onLogin);
				element.removeEventListener('close', onClose);
				element.removeEventListener('error', onError);
			};
		}, []);

		return (
			<section>
				<sty-notifications></sty-notifications>
				<sty-login ref={loginRef}></sty-login>
				<sty-language-selector></sty-language-selector>
			</section>
		);
	},

	native: function () {
		const searchParams = new URLSearchParams(globalThis?.window?.location.search);
		const ctx = useNativeLogin({
			params: {
				...extraParams,
				prompt: 'create',
				sessionId: searchParams.get('session_id'),
				language: searchParams.get('language'),
			},
			onLogin: async () => {
				route('/profile');
			},
			onClose: () => {
				globalThis.location.reload();
			},
			onError: async (error) => {
				route(`/error?error=${encodeURIComponent(error.message)}`);
			},
			onFallback: (error) => {
				globalThis.location.href = error.url.toString();
			},
			onGlobalMessage: async (message) => {
				alert(message.text);
			},
		});

		if (ctx.loading || !ctx.state.screen) {
			return (
				<section>
					<p>Loading...</p>
				</section>
			);
		}

		return (
			<section className="login-renderer">
				<widgets.layout formId={(ctx.state.layout?.items?.[0] as Widget | undefined)?.formId} type={ctx.state.layout?.type} tag="form">
					<WidgetRenderer items={ctx.state.layout?.items} />
				</widgets.layout>
			</section>
		);
	},
};

export default components[mode];
