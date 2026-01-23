import { Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity, StyLoginRenderer, FallbackError, type LoginFlowState, type ExtraRequestArgs } from '@strivacity/sdk-remix';
import { widgets } from '../components/widgets';

export default function Login() {
	const navigate = useNavigate();
	const { options, loading, login } = useStrivacity();
	const [urlHandled, setUrlHandled] = useState<boolean>(false);
	const [sessionId, setSessionId] = useState<string | null>(null);

	const extraParams: ExtraRequestArgs = {
		loginHint: import.meta.env.VITE_LOGIN_HINT,
		acrValues: import.meta.env.VITE_ACR_VALUES ? import.meta.env.VITE_ACR_VALUES.split(' ') : undefined,
		uiLocales: import.meta.env.VITE_UI_LOCALES ? import.meta.env.VITE_UI_LOCALES.split(' ') : undefined,
		audiences: import.meta.env.VITE_AUDIENCES ? import.meta.env.VITE_AUDIENCES.split(' ') : undefined,
	};

	useEffect(() => {
		if (window.location.search !== '') {
			const url = new URL(window.location.href);
			const sid = url.searchParams.get('session_id');
			setSessionId(sid);
			url.search = '';
			window.history.replaceState({}, '', url.toString());
		}

		setUrlHandled(true);
	}, []);

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			if (options.mode === 'redirect') {
				await login(extraParams);
			} else if (options.mode === 'popup') {
				await login(extraParams);
				await navigate('/profile');
			}
		})();
	}, []);

	const onLogin = async () => {
		await navigate('/profile');
	};
	const onFallback = (error: FallbackError) => {
		if (error.url) {
			window.location.href = error.url.toString();
		} else {
			alert(error);
		}
	};
	const onClose = () => {
		location.reload();
	};
	const onError = (error: string) => {
		alert(error);
	};
	const onGlobalMessage = (message: string) => {
		alert(message);
	};
	const onBlockReady = (_events: { previousState: LoginFlowState; state: LoginFlowState }) => {
		// You can handle block ready events here
	};

	return (
		<section>
			{options.mode === 'redirect' && <h1>Redirecting...</h1>}
			{options.mode === 'popup' && <h1>Loading...</h1>}
			{options.mode === 'native' && !loading && urlHandled && (
				<Suspense fallback={<span>Loading...</span>}>
					<StyLoginRenderer
						params={extraParams}
						widgets={widgets}
						sessionId={sessionId}
						onFallback={onFallback}
						onClose={onClose}
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
