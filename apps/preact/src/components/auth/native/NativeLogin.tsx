import type { CheckboxWidget, PasswordWidget, StaticWidget, SubmitWidget } from '@strivacity/sdk-preact';
import { useNativeLogin } from '@strivacity/sdk-preact';
import { route } from 'preact-router';
import { widgets } from './widgets';
import NativeLoginRenderer from './NativeLoginRenderer';
import { extraParams } from '../';

export default function NativeLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const searchParams = new URLSearchParams(globalThis?.window?.location.search);

	// useNativeLogin() drives a "headless" auth flow: instead of redirecting to a hosted page,
	// the SDK returns a JSON description of the current screen that this component renders itself.
	// It exposes reactive refs and actions to advance the flow, and fires the callbacks below at key points.
	const ctx = useNativeLogin({
		params: {
			...extraParams,
			...(flowType === 'register' ? { prompt: 'create' } : {}),
			// Resume a session started from an entry URL (e.g. a password-reset)
			sessionId: searchParams.get('session_id'),
			language: searchParams.get('language'),
		},
		onLogin: async () => {
			// You can handle the login event (e.g. to redirect the user to the profile page)
			route('/profile');
		},
		onClose: () => {
			// You can handle the close event (e.g. to redirect the user to a different page or reload the current page)
			globalThis.location.reload();
		},
		onError: async (error) => {
			// You can handle errors (e.g. to show an error page)
			route(`/error?error=${encodeURIComponent(error.message)}`);
		},
		onFallback: (error) => {
			// Fallback to the hosted journey (e.g. in cases where the native widget or screen is not supported)
			globalThis.location.href = error.url.toString();
		},
		onGlobalMessage: async (message) => {
			// You can handle global messages (e.g. to show a toast notification)
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

	// Custom markup for the 'password' screen instead of the generic renderer below
	if (ctx.state.screen === 'password') {
		// Each SDK screen is made up of one or more "forms", and each form holds a flat list of
		// "widgets" (inputs/buttons) identified by id. Here we look those widgets up by hand so we
		// can lay them out with fully custom markup instead of using the generic WidgetRenderer below.
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
					{/* You can add custom elements */}
					<div style={{ textAlign: 'center' }}>This is a custom text</div>
					<widgets.password formId="password" config={passwordInputWidget} />
					<widgets.checkbox formId="password" config={keepMeLoggedInWidget} />
					{/* You can override widget rendering also */}
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

	// Every other screen: render its layout generically
	return <NativeLoginRenderer layout={ctx.state.layout} />;
}
