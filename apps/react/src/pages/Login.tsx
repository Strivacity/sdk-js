import type { PopupFlow, LoginComponent, CheckboxWidget, PasswordWidget, StaticWidget, SubmitWidget, Widget } from '@strivacity/sdk-react';
import { useEffect, useRef, type ComponentType } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity, useNativeLogin, injectScript } from '@strivacity/sdk-react';
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
		const { loading, login } = useStrivacity<PopupFlow>();

		useEffect(() => {
			if (loading) {
				return;
			}

			void login(extraParams);
		}, [loading, login]);

		return (
			<section>
				<p>Loading...</p>
			</section>
		);
	},

	popup: function () {
		const { loading, login } = useStrivacity<PopupFlow>();
		const navigate = useNavigate();

		useEffect(() => {
			if (loading) {
				return;
			}

			login(extraParams)
				.then(() => {
					void navigate('/profile');
				})
				.catch((error) => {
					void navigate(`/error?error_description=${encodeURIComponent(error)}`);
				});
		}, [loading, login]);

		return (
			<section>
				<p>Loading...</p>
			</section>
		);
	},

	embedded: function () {
		const navigate = useNavigate();
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

			element.params = extraParams;
			element.sessionId = sessionId;
			element.shortAppId = shortAppId;
			element.lang = language;

			const onLogin = () => {
				void navigate('/profile');
			};
			const onClose = () => {
				globalThis.location.reload();
			};
			const onError = (event: Event) => {
				void navigate(`/error?error=${encodeURIComponent((event as CustomEvent<string>).detail)}`);
			};

			element.addEventListener('login', onLogin);
			element.addEventListener('close', onClose);
			element.addEventListener('error', onError);

			return () => {
				element.removeEventListener('login', onLogin);
				element.removeEventListener('close', onClose);
				element.removeEventListener('error', onError);
			};
		}, [navigate]);

		return (
			<section>
				<sty-notifications></sty-notifications>
				<sty-login ref={loginRef}></sty-login>
				<sty-language-selector></sty-language-selector>
			</section>
		);
	},

	native: function () {
		const navigate = useNavigate();
		const searchParams = new URLSearchParams(globalThis?.window?.location.search);
		const ctx = useNativeLogin({
			params: {
				...extraParams,
				sessionId: searchParams.get('session_id'),
				language: searchParams.get('language'),
			},
			onLogin: async () => {
				await navigate('/profile');
			},
			onClose: () => {
				globalThis.location.reload();
			},
			onError: async (error) => {
				await navigate(`/error?error=${encodeURIComponent(error.message)}`);
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

		// NOTE: You can override the password screen
		if (ctx.state.screen === 'password') {
			const passwordForm = ctx.state.forms?.find((form) => form.id === 'password');
			const resetForm = ctx.state.forms?.find((form) => form.id === 'reset');
			const sectionTitleWidget = passwordForm?.widgets?.find((widget) => widget.id === 'section-title') as StaticWidget;
			const passwordInputWidget = passwordForm?.widgets?.find((widget) => widget.id === 'password') as PasswordWidget;
			const keepMeLoggedInWidget = passwordForm?.widgets?.find((widget) => widget.id === 'keepMeLoggedIn') as CheckboxWidget;
			const resetSubmitWidget = resetForm?.widgets?.find((widget) => widget.id === 'submit') as SubmitWidget;

			return (
				<section className="login-renderer">
					<form
						data-widget="layout"
						data-type="vertical"
						data-form-id="password"
						onSubmit={async (event) => {
							event.preventDefault();
							await ctx.submitForm('password');
						}}
					>
						<widgets.static formId="password" config={sectionTitleWidget} />
						<widgets.password formId="password" config={passwordInputWidget} />
						<widgets.checkbox formId="password" config={keepMeLoggedInWidget} />
						<button
							type="submit"
							disabled={ctx.loading}
							data-widget="submit"
							data-type="button"
							data-variant="primary"
							data-form-id="password"
							data-widget-id="submit"
						>
							Custom button
						</button>
						{resetForm && <widgets.submit formId="reset" config={resetSubmitWidget} />}
					</form>
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
