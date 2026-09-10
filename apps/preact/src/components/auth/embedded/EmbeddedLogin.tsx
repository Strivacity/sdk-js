import { useEffect, useRef } from 'preact/compat';
import type { LoginComponent } from '@strivacity/sdk-preact';
import { injectScript } from '@strivacity/sdk-preact';
import { route } from 'preact-router';
import { extraParams } from '../';

// "Embedded" mode doesn't use any SDK composable directly. Instead the Strivacity auth server
// ships a bundle of pre-built, framework-agnostic web components (custom elements) that render
// the whole login UI inside <sty-login>. This component just configures and mounts
// that element and reacts to the DOM events it dispatches.

const issuer = import.meta.env.VITE_ISSUER;

export default function EmbeddedLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const searchParams = new URLSearchParams(globalThis?.window?.location.search);
	// Resume a session started from an entry URL (e.g. a password-reset)
	const sessionId = searchParams.get('session_id');
	const shortAppId = searchParams.get('short_app_id');
	const language = searchParams.get('language') ?? globalThis.navigator?.language;
	const loginRef = useRef<LoginComponent>(null);

	useEffect(() => {
		// injectScript loads the <sty-login>/<sty-notifications>/<sty-language-selector>
		// custom element definitions from the auth server
		injectScript('sty-components', `${issuer}/assets/components/bundle.js`);
	}, []);

	useEffect(() => {
		const element = loginRef.current;

		if (!element) {
			return;
		}

		element.params = flowType === 'register' ? { ...extraParams, prompt: 'create' } : extraParams;
		element.sessionId = sessionId;
		element.shortAppId = shortAppId;
		element.lang = language;

		const onLogin = () => {
			// Fired by <sty-login> once the user completes the flow
			route('/profile');
		};
		const onClose = () => {
			// Fired when the user finishes the flow with a close action (e.g. close button)
			globalThis.location.reload();
		};
		const onError = (event: Event) => {
			// Fired when the flow can't continue (e.g. network/config problem)
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
	}, [flowType, sessionId, shortAppId, language]);

	return (
		<section className="login-renderer">
			<sty-notifications></sty-notifications>
			<sty-login ref={loginRef}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
