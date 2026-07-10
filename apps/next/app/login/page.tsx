'use client';

import type { PopupFlow, LoginComponent, CheckboxWidget, PasswordWidget, StaticWidget, SubmitWidget, Widget } from '@strivacity/sdk-next/client';
import { useEffect, useRef, type ComponentType } from 'react';
import { redirect as NextRedirect } from 'next/navigation';
import { useStrivacity, useNativeLogin, injectScript } from '@strivacity/sdk-next/client';
import { WidgetRenderer, widgets } from '../../components/login';

const issuer = process.env.ISSUER;
const mode = process.env.MODE;
const extraParams: Record<string, string | Array<string>> = {
	loginSessionUri: '/auth/login/session',
	loginHint: process.env.LOGIN_HINT,
	acrValues: process.env.ACR_VALUES?.split(' '),
	uiLocales: process.env.UI_LOCALES?.split(' '),
	audiences: process.env.AUDIENCES?.split(' '),
};
const extraSearchParams: Array<[string, string]> = Object.entries(extraParams).flatMap(([key, value]) =>
	(Array.isArray(value) ? value : [value]).map((item) => [key, String(item)] as [string, string]),
);

// NOTE: This demo shows both session modes side by side.
// in your own app, keep only the branch matching your `serverSideSession` setting.
const components: Record<string, ComponentType> = {
	redirect: function () {
		NextRedirect(`/auth/login?${new URLSearchParams(extraSearchParams).toString()}`);
	},

	popup: function () {
		const { loading, login } = useStrivacity<PopupFlow>();

		useEffect(() => {
			if (loading) {
				return;
			}

			login(extraParams)
				.then(() => {
					globalThis.location.href = '/profile';
				})
				.catch((error) => {
					globalThis.location.href = `/error?error_description=${encodeURIComponent(error)}`;
				});
		}, [loading, login]);

		return (
			<section>
				<p>Loading...</p>
			</section>
		);
	},

	embedded: function () {
		const { loading, sdk } = useStrivacity();
		const loginRef = useRef<LoginComponent>(null);

		// NOTE: Load search params from URL from entry redirect
		const searchParams = new URLSearchParams(globalThis?.window?.location.search);
		const sessionId = searchParams.get('session_id');
		const shortAppId = searchParams.get('short_app_id');
		const language = searchParams.get('language') ?? globalThis.navigator?.language;

		const onLogin = () => {
			globalThis.location.href = '/profile';
		};
		const onClose = () => {
			globalThis.location.reload();
		};
		const onError = (errorOrEvent: Error | CustomEvent<string>) => {
			const message = errorOrEvent instanceof Error ? errorOrEvent.message : errorOrEvent.detail;
			globalThis.location.href = `/error?error=${encodeURIComponent(message)}`;
		};

		useEffect(() => {
			if (loading) {
				return;
			}

			// NOTE: Load components bundle script
			injectScript('sty-components', `${issuer}/assets/components/bundle.js`);

			void (async () => {
				const loginComponent = loginRef.current;

				if (!loginComponent) {
					return;
				}

				loginComponent.params = extraParams;
				loginComponent.shortAppId = shortAppId;
				loginComponent.sessionId = sessionId;
				loginComponent.lang = language;

				loginRef.current.addEventListener('login', onLogin);
				loginRef.current.addEventListener('close', onClose);
				loginRef.current.addEventListener('error', onError as EventListener);
			})();

			return () => {
				loginRef.current.removeEventListener('login', onLogin);
				loginRef.current.removeEventListener('close', onClose);
				loginRef.current.removeEventListener('error', onError as EventListener);
			};
		}, [loading]);

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

		if (ctx.loading || !ctx.state.screen) {
			return (
				<section>
					<p>Loading...</p>
				</section>
			);
		}

		// NOTE: You can override the password screen
		if (ctx.state.screen === 'password') {
			const hasResetForm = ctx.state.forms?.find((form) => form.id === 'reset');
			const sectionTitleWidget = ctx.state.forms
				?.find((form) => form.id === 'password')
				?.widgets?.find((widget) => widget.id === 'section-title') as StaticWidget;
			const passwordInputWidget = ctx.state.forms
				?.find((form) => form.id === 'password')
				?.widgets?.find((widget) => widget.id === 'password') as PasswordWidget;
			const keepMeLoggedInWidget = ctx.state.forms
				?.find((form) => form.id === 'password')
				?.widgets?.find((widget) => widget.id === 'keepMeLoggedIn') as CheckboxWidget;
			const resetSubmitWidget = ctx.state.forms?.find((form) => form.id === 'reset')?.widgets?.find((widget) => widget.id === 'submit') as SubmitWidget;

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
						{hasResetForm && <widgets.submit formId="reset" config={resetSubmitWidget} />}
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
