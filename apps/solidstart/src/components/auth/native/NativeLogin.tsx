import type { CheckboxWidget, PasswordWidget, StaticWidget, SubmitWidget, Widget } from '@strivacity/sdk-solid/client';
import { Show, untrack } from 'solid-js';
import { STRIVACITY_LOGIN_CONTEXT, useNativeLogin } from '@strivacity/sdk-solid/client';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { widgets } from './widgets';
import NativeLoginRenderer from './NativeLoginRenderer';
import { extraParams } from '../../../options';

export default function NativeLogin(props: { flowType: 'login' | 'register' }) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	// useNativeLogin() drives a "headless" auth flow: instead of redirecting to a hosted page,
	// the SDK returns a JSON description of the current screen that this component renders itself.
	// It exposes reactive refs and actions to advance the flow, and fires the callbacks below at key points.
	const ctx = useNativeLogin({
		params: {
			...extraParams,
			...(props.flowType === 'register' ? { prompt: 'create' } : {}),
			// Resume a session started from an entry URL (e.g. a password-reset). Read once at mount - not meant to react to later URL changes.
			...untrack(() => ({
				sessionId: searchParams.session_id as string | undefined,
				language: searchParams.language as string | undefined,
			})),
		},
		onLogin: async () => {
			// You can handle the login event (e.g. to redirect the user to the profile page)
			// Only called when the app runs in client-side mode (sdk.options.serverSessionUri is not set)
			navigate('/profile');
		},
		onClose: () => {
			// You can handle the close event (e.g. to redirect the user to a different page or reload the current page)
			globalThis.location.reload();
		},
		onError: async (error) => {
			// You can handle errors (e.g. to show an error page)
			navigate(`/error?error=${encodeURIComponent(error.message)}`);
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

	return (
		<STRIVACITY_LOGIN_CONTEXT value={ctx}>
			<Show
				when={!ctx.loading() && ctx.state().screen}
				fallback={
					<section>
						<p>Loading...</p>
					</section>
				}
			>
				<Show
					when={ctx.state().screen === 'password'}
					fallback={
						// Every other screen: render its layout generically
						<NativeLoginRenderer layout={ctx.state().layout} />
					}
				>
					{/* Custom markup for the 'password' screen instead of the generic renderer below */}
					<PasswordScreen ctx={ctx} />
				</Show>
			</Show>
		</STRIVACITY_LOGIN_CONTEXT>
	);
}

function PasswordScreen(props: { ctx: ReturnType<typeof useNativeLogin> }) {
	// Each SDK screen is made up of one or more "forms", and each form holds a flat list of
	// "widgets" (inputs/buttons) identified by id. Here we look those widgets up by hand so we
	// can lay them out with fully custom markup instead of using the generic WidgetRenderer below.
	const passwordForm = () => props.ctx.state().forms?.find((form) => form.id === 'password');
	const resetForm = () => props.ctx.state().forms?.find((form) => form.id === 'reset');
	const sectionTitleWidget = () => passwordForm()?.widgets?.find((widget) => widget.id === 'section-title') as StaticWidget;
	const passwordInputWidget = () => passwordForm()?.widgets?.find((widget) => widget.id === 'password') as PasswordWidget;
	const keepMeLoggedInWidget = () => passwordForm()?.widgets?.find((widget) => widget.id === 'keepMeLoggedIn') as CheckboxWidget;
	const resetSubmitWidget = () => resetForm()?.widgets?.find((widget) => widget.id === 'submit') as SubmitWidget;

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		await props.ctx.submitForm('password');
	}

	return (
		<section class="login-renderer">
			<form data-widget="layout" data-type="vertical" data-form-id="password" onSubmit={onSubmit}>
				<widgets.static formId="password" config={sectionTitleWidget()} />
				{/* You can add custom elements */}
				<div style={{ 'text-align': 'center' }}>This is a custom text</div>
				<widgets.password formId="password" config={passwordInputWidget()} />
				<widgets.checkbox formId="password" config={keepMeLoggedInWidget()} />
				{/* You can override widget rendering also */}
				<button
					type="submit"
					disabled={props.ctx.loading()}
					data-widget="submit"
					data-type="button"
					data-variant="primary"
					data-form-id="password"
					data-widget-id="submit"
				>
					Custom button
				</button>
				<Show when={resetForm()}>
					<widgets.submit formId="reset" config={resetSubmitWidget()} />
				</Show>
			</form>
		</section>
	);
}
