'use client';

import type { AuthProviderProps, EmbeddedFlow, IdTokenClaims, NativeFlow, PopupFlow, RedirectFlow, SDKContext } from '../../types';
import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { initFlow } from '@strivacity/sdk-core';
import { isSessionExpired } from '@strivacity/sdk-core/utils';
import { STRIVACITY_SDK } from '../composables';

let sdk: Awaited<ReturnType<typeof initFlow>>;

export function StyAuthProvider({ options, session, children }: AuthProviderProps) {
	const [loading, setLoading] = useState<boolean>(true);
	const [language, setLanguage] = useState<string>(globalThis.navigator?.language ?? 'en-US');
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [idTokenClaims, setIdTokenClaims] = useState<IdTokenClaims | null>(null);
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [refreshToken, setRefreshToken] = useState<string | null>(null);
	const [accessTokenExpired, setAccessTokenExpired] = useState<boolean>(true);
	const [accessTokenExpirationDate, setAccessTokenExpirationDate] = useState<number | null>(null);
	const sdkEvents = useRef<{ dispose: () => void }>(null);

	const updateSession = () => {
		const sessionExpired = !isSessionExpired(sdk.session);

		// TODO: auto refresh

		if (loading) {
			setLoading(false);
		}
		if (sdk.language !== language) {
			setLanguage(sdk.language);
		}
		if (sessionExpired !== isAuthenticated) {
			setIsAuthenticated(sessionExpired);
		}
		if (sdk.idTokenClaims !== idTokenClaims) {
			setIdTokenClaims(sdk.idTokenClaims || null);
		}
		if (sdk.accessToken !== accessToken) {
			setAccessToken(sdk.accessToken || null);
		}
		if (sdk.refreshToken !== refreshToken) {
			setRefreshToken(sdk.refreshToken || null);
		}
		if (sdk.accessTokenExpired !== accessTokenExpired) {
			setAccessTokenExpired(sdk.accessTokenExpired);
		}
		if (sdk.accessTokenExpirationDate !== accessTokenExpirationDate) {
			setAccessTokenExpirationDate(sdk.accessTokenExpirationDate || null);
		}
	};

	useEffect(() => {
		if (!sdk) {
			initFlow(options as never)
				.then((instance) => {
					if (session) {
						instance.session = session;
					}

					sdk = instance as unknown as Awaited<ReturnType<typeof initFlow>>;
					sdkEvents.current = sdk.subscribeToAllEvents(updateSession);
				})
				.catch((error) => {
					// eslint-disable-next-line no-console
					console.error('Failed to initialize Strivacity SDK:', error);
				});
		}

		return () => {
			sdkEvents.current?.dispose();
		};
	}, []);

	const value = useMemo<SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow>>(() => {
		return {
			sdk,
			loading,
			language,
			isAuthenticated,
			idTokenClaims,
			accessToken,
			refreshToken,
			accessTokenExpired,
			accessTokenExpirationDate,
			init: () => {
				return sdk.init();
			},
			subscribeToEvent: ((...args: Parameters<typeof sdk.subscribeToEvent>) => {
				return sdk.subscribeToEvent(...args);
			}) as typeof sdk.subscribeToEvent,
			subscribeToAllEvents: (...args: Parameters<typeof sdk.subscribeToAllEvents>) => {
				return sdk.subscribeToAllEvents(...args);
			},
			checkAuthentication: (...args: Parameters<typeof sdk.checkAuthentication>) => {
				return sdk.checkAuthentication(...args);
			},
			getAccessToken: (...args: Parameters<typeof sdk.getAccessToken>) => {
				return sdk.getAccessToken(...args);
			},
			tokenExchange: (...args: Parameters<typeof sdk.tokenExchange>) => {
				return sdk.tokenExchange(...args);
			},
			handleCallback: (...args: Parameters<typeof sdk.handleCallback>) => {
				return sdk.handleCallback(...args);
			},
			startSession: (...args: Parameters<typeof sdk.startSession>) => {
				if (!['native', 'embedded'].includes(sdk.options.mode)) {
					throw new Error(`Invalid submitForm mode: ${sdk.options.mode}. Expected 'native' or 'embedded'.`);
				}

				return sdk.startSession(...args);
			},
			finalizeSession: (...args: Parameters<typeof sdk.finalizeSession>) => {
				if (!['native', 'embedded'].includes(sdk.options.mode)) {
					throw new Error(`Invalid submitForm mode: ${sdk.options.mode}. Expected 'native' or 'embedded'.`);
				}

				return sdk.finalizeSession(...args);
			},
			submitForm: (...args: Parameters<typeof sdk.submitForm>) => {
				if (!['native'].includes(sdk.options.mode)) {
					throw new Error(`Invalid submitForm mode: ${sdk.options.mode}. Expected 'native'.`);
				}

				return (sdk as unknown as NativeFlow).submitForm(...args);
			},
			refresh: () => {
				return sdk.refresh();
			},
			revoke: () => {
				return sdk.revoke();
			},
			logout: (...args: Parameters<typeof sdk.logout>) => {
				return sdk.logout(...args);
			},
			login: (...args: Parameters<typeof sdk.login>) => {
				if (!['redirect', 'popup'].includes(sdk.options.mode)) {
					throw new Error(`Invalid login mode: ${sdk.options.mode}. Expected 'redirect' or 'popup'.`);
				}

				return (sdk as unknown as RedirectFlow | PopupFlow).login(...args);
			},
			register: (...args: Parameters<typeof sdk.register>) => {
				if (!['redirect', 'popup'].includes(sdk.options.mode)) {
					throw new Error(`Invalid login mode: ${sdk.options.mode}. Expected 'redirect' or 'popup'.`);
				}

				return (sdk as unknown as RedirectFlow | PopupFlow).register(...args);
			},
			entry: (...args: Parameters<typeof sdk.entry>) => {
				return sdk.entry(...args);
			},
		};
	}, [sdk, loading, isAuthenticated, idTokenClaims, accessToken, refreshToken, accessTokenExpired, accessTokenExpirationDate]);

	return (
		<STRIVACITY_SDK.Provider value={value as never}>
			{options.mode === 'embedded' && <Script src={`${options.issuer}/assets/components/bundle.js`} type="module" strategy="afterInteractive" />}
			{children}
		</STRIVACITY_SDK.Provider>
	);
}
