/* eslint-disable no-async-promise-executor, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises */
import { Suspense, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser';
import { redirectUrlHandler } from '@strivacity/sdk-core/utils/handlers';
import { useStrivacity, StyLoginRenderer, FallbackError, type LoginFlowState, type ExtraRequestArgs } from '@strivacity/sdk-react';
import { widgets } from '../components/widgets';

export const Register = () => {
	const navigate = useNavigate();
	const { sdk, options, register } = useStrivacity();
	const [loading, setLoading] = useState<boolean>(true);
	const [shortAppId, setShortAppId] = useState<string | null>(null);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const loginRef = useRef<(HTMLElement & { __cleanup: () => void }) | null>(null);

	const extraParams: ExtraRequestArgs = {
		prompt: 'create',
		loginHint: import.meta.env.VITE_LOGIN_HINT,
		acrValues: import.meta.env.VITE_ACR_VALUES ? import.meta.env.VITE_ACR_VALUES.split(' ') : undefined,
		uiLocales: import.meta.env.VITE_UI_LOCALES ? import.meta.env.VITE_UI_LOCALES.split(' ') : undefined,
		audiences: import.meta.env.VITE_AUDIENCES ? import.meta.env.VITE_AUDIENCES.split(' ') : undefined,
	};

	useEffect(() => {
		if (window.location.search !== '') {
			const url = new URL(window.location.href);
			const sAppId = url.searchParams.get('short_app_id');
			const sid = url.searchParams.get('session_id');
			setShortAppId(sAppId);
			setSessionId(sid);
			url.search = '';
			window.history.replaceState({}, '', url.toString());
		}

		setLoading(false);
	}, []);

	useEffect(() => {
		(async () => {
			if (options.mode === 'redirect') {
				await register(extraParams);

				if (Capacitor.getPlatform() !== 'web') {
					const params = (await options.callbackHandler!(options.redirectUri, options.responseMode || 'fragment')) as Record<string, string>;
					await sdk.tokenExchange(params);
					await navigate('/profile');
				}
			} else if (options.mode === 'popup') {
				await register(extraParams);
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
			alert(error);
		}
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
	const onClose = () => {
		location.reload();
	};
	const loginRefCallback = (element: (HTMLElement & { __cleanup: () => void }) | null) => {
		if (loginRef.current) {
			const prev = loginRef.current;
			if (prev.__cleanup) {
				prev.__cleanup();
			}
		}

		loginRef.current = element;

		if (element) {
			const handleClose = () => onClose();
			const handleLogin = () => void onLogin();
			const handleError = (event: Event) => onError((event as CustomEvent).detail);
			const handleBlockReady = (event: Event) => onBlockReady((event as CustomEvent).detail);

			element.addEventListener('close', handleClose);
			element.addEventListener('login', handleLogin);
			element.addEventListener('error', handleError);
			element.addEventListener('block-ready', handleBlockReady);

			element.__cleanup = () => {
				element.removeEventListener('close', handleClose);
				element.removeEventListener('login', handleLogin);
				element.removeEventListener('error', handleError);
				element.removeEventListener('block-ready', handleBlockReady);
			};
		}
	};

	return (
		<section>
			{options.mode === 'redirect' && <h1>Redirecting...</h1>}
			{options.mode === 'popup' && <h1>Loading...</h1>}
			{options.mode === 'embedded' && !loading && (
				<>
					<sty-notifications></sty-notifications>
					<sty-login ref={loginRefCallback} shortAppId={shortAppId} sessionId={sessionId} params={extraParams}></sty-login>
					<sty-language-selector></sty-language-selector>
				</>
			)}
			{options.mode === 'native' && !loading && (
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
};
