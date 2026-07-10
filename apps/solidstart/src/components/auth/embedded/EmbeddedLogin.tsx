import type { LoginComponent } from '@strivacity/sdk-solid/client';
import { onSettled } from 'solid-js';
import { injectScript } from '@strivacity/sdk-solid/client';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { extraParams } from '../../../options';

// "Embedded" mode doesn't use any SDK composable directly. Instead the Strivacity auth server
// ships a bundle of pre-built, framework-agnostic web components (custom elements) that render
// the whole login UI inside <sty-login>. This component just configures and mounts
// that element and reacts to the DOM events it dispatches.

export default function EmbeddedLogin(props: { flowType: 'login' | 'register' }) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	let loginElement: LoginComponent | undefined;

	onSettled(() => {
		// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
		// custom element definitions from the auth server
		injectScript('sty-components', `${import.meta.env.VITE_ISSUER}/assets/components/bundle.js`);

		const element = loginElement;

		if (!element) {
			return;
		}

		element.params = props.flowType === 'register' ? { ...extraParams, prompt: 'create' } : extraParams;
		// Resume a session started from an entry URL (e.g. a password-reset)
		element.sessionId = (searchParams.session_id as string | undefined) ?? null;
		element.shortAppId = (searchParams.short_app_id as string | undefined) ?? null;
		element.lang = (searchParams.language as string | undefined) ?? globalThis.navigator?.language;

		const onLogin = () => {
			// Fired by <sty-login> once the user completes the flow
			navigate('/profile');
		};
		const onClose = () => {
			// Fired when the user finishes the flow with a close action (e.g. close button)
			globalThis.location.reload();
		};
		const onError = (event: Event) => {
			// Fired when the flow can't continue (e.g. network/config problem)
			navigate(`/error?error=${encodeURIComponent((event as CustomEvent<string>).detail)}`);
		};

		element.addEventListener('login', onLogin);
		element.addEventListener('close', onClose);
		element.addEventListener('error', onError);

		return () => {
			element.removeEventListener('login', onLogin);
			element.removeEventListener('close', onClose);
			element.removeEventListener('error', onError);
		};
	});

	return (
		<section class="login-renderer">
			<sty-notifications></sty-notifications>
			<sty-login ref={(el) => (loginElement = el)}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
