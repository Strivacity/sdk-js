import { useNavigate } from '@remix-run/react';
import { FallbackError, StyLoginRenderer, useStrivacity, type LoginFlowState } from '@strivacity/sdk-remix';
import { Suspense, useEffect, useState } from 'react';
import { widgets } from '../components/widgets';

export default function Login() {
	const navigate = useNavigate();
	const { options, login } = useStrivacity();
	const [sessionId, setSessionId] = useState<string | null>(null);

	useEffect(() => {
		if (window.location.search !== '') {
			const url = new URL(window.location.href);
			const sid = url.searchParams.get('session_id');
			setSessionId(sid);
			url.search = '';
			window.history.replaceState({}, '', url.toString());
		}
	}, []);

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			if (options.mode === 'redirect') {
				await login();
			} else if (options.mode === 'popup') {
				await login();
				navigate('/profile');
			}
		})();
	}, []);

	const onLogin = () => {
		navigate('/profile');
	};
	const onFallback = (error: FallbackError) => {
		if (error.url) {
			// eslint-disable-next-line no-console
			console.log(`Fallback: ${error.url}`);
			window.location.href = error.url.toString();
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

	return (
		<section>
			{options.mode === 'redirect' && <h1>Redirecting...</h1>}
			{options.mode === 'popup' && <h1>Loading...</h1>}
			{options.mode === 'native' && (
				<Suspense fallback={<span>Loading...</span>}>
					<StyLoginRenderer
						widgets={widgets}
						sessionId={sessionId}
						onFallback={onFallback}
						onLogin={() => void onLogin()}
						onError={onError}
						onGlobalMessage={onGlobalMessage}
						onBlockReady={onBlockReady}
					/>
				</Suspense>
			)}
		</section>
	);
}
