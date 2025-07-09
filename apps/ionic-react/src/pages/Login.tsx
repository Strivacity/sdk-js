/* eslint-disable no-async-promise-executor, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises */
import { Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler } from '@strivacity/sdk-core/utils/handlers';
import { useStrivacity, StyLoginRenderer, FallbackError, type LoginFlowState } from '@strivacity/sdk-react';
import { widgets } from '../components/widgets';

export const Login = () => {
	const navigate = useNavigate();
	const { sdk, options, login } = useStrivacity();
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
		(async () => {
			if (options.mode === 'redirect') {
				await login();

				if (Capacitor.getPlatform() !== 'web') {
					const params = (await options.callbackHandler!(options.redirectUri, options.responseMode || 'fragment')) as Record<string, string>;
					await sdk.tokenExchange(params);
					await navigate('/profile');
				}
			} else if (options.mode === 'popup') {
				await login();
				await navigate('/profile');
			}
		})();
	}, []);

	const onLogin = async () => {
		await navigate('/profile');
	};
	const onFallback = async (error: FallbackError) => {
		if (error.url) {
			if (Capacitor.getPlatform() === 'web') {
				return redirectUrlHandler(error.url.toString());
			} else {
				await InAppBrowser.openInWebView({ url: error.url.toString(), options: DefaultWebViewOptions });

				const params = await new Promise<Record<string, string>>(async (resolve, reject) => {
					let navigationListener: PluginListenerHandle | null = null;
					let finishListener: PluginListenerHandle | null = null;
					let userCancelled = true;

					const cleanupListeners = async () => {
						if (navigationListener) {
							await navigationListener.remove();
							navigationListener = null;
						}

						if (finishListener) {
							await finishListener.remove();
							finishListener = null;
						}
					};

					try {
						navigationListener = await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
							const navigatedUrl = event.url;

							if (navigatedUrl && navigatedUrl.startsWith(options.redirectUri)) {
								try {
									const urlInstance = new URL(navigatedUrl);
									const dataString = options.responseMode === 'query' ? urlInstance.search : urlInstance.hash;
									const params = Object.fromEntries(new URLSearchParams(dataString.slice(1)));

									userCancelled = false;
									await InAppBrowser.close();
									resolve(params);
								} catch (error) {
									await InAppBrowser.close();
									reject(error);
								}
							}
						});
						finishListener = await InAppBrowser.addListener('browserClosed', async () => {
							await cleanupListeners();

							if (userCancelled) {
								reject(new Error('InAppBrowser flow cancelled by user.'));
							}
						});
					} catch (error) {
						reject(error);
					}
				});

				if (params.session_id) {
					await navigate(`/callback?session_id=${params.session_id}`);
				} else {
					await sdk.tokenExchange(params);
					await navigate('/profile');
				}
			}
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
};
