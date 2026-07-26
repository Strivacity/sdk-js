import type { IdTokenClaims, RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, SDKContext, SDKInstance, StyAuthProviderProps } from './types';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { initFlow } from '@strivacity/sdk-core';
import { STRIVACITY_SDK } from './hooks';

let sdk: SDKInstance;

export function StyAuthProvider({ options, session, children }: StyAuthProviderProps) {
	const [loading, setLoading] = useState<boolean>(true);
	const [language, setLanguage] = useState<string>(globalThis.navigator?.language ?? 'en-US');
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [idTokenClaims, setIdTokenClaims] = useState<IdTokenClaims | null>(null);
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [refreshToken, setRefreshToken] = useState<string | null>(null);
	const [accessTokenExpired, setAccessTokenExpired] = useState<boolean>(true);
	const [accessTokenExpirationDate, setAccessTokenExpirationDate] = useState<number | null>(null);
	const sdkEvents = useRef<{ dispose: () => void }>(null);

	const updateSession = async () => {
		const authenticated = await sdk.isAuthenticated;

		if (loading) {
			setLoading(false);
		}
		if (sdk.language !== language) {
			setLanguage(sdk.language);
		}
		if (authenticated !== isAuthenticated) {
			setIsAuthenticated(authenticated);
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
		sdk = initFlow(options as never) as unknown as SDKInstance;
		sdkEvents.current = sdk.subscribeToAllEvents(updateSession);

		if (session) {
			sdk.session = session;
		}

		void updateSession();

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
			init: () => sdk.init(),
			subscribeToEvent: ((...args: Parameters<typeof sdk.subscribeToEvent>) => sdk.subscribeToEvent(...args)) as typeof sdk.subscribeToEvent,
			subscribeToAllEvents: (...args: Parameters<typeof sdk.subscribeToAllEvents>) => sdk.subscribeToAllEvents(...args),
			checkAuthentication: (...args: Parameters<typeof sdk.checkAuthentication>) => sdk.checkAuthentication(...args),
			getAccessToken: (...args: Parameters<typeof sdk.getAccessToken>) => sdk.getAccessToken(...args),
			tokenExchange: (...args: Parameters<typeof sdk.tokenExchange>) => sdk.tokenExchange(...args),
			handleCallback: (...args: Parameters<typeof sdk.handleCallback>) => sdk.handleCallback(...args),
			refresh: () => sdk.refresh(),
			revoke: () => sdk.revoke(),
			logout: (...args: Parameters<typeof sdk.logout>) => sdk.logout(...args),
			login: (...args: Parameters<typeof sdk.login>) => sdk.login(...args),
			register: (...args: Parameters<typeof sdk.register>) => sdk.register(...args),
			entry: (...args: Parameters<typeof sdk.entry>) => sdk.entry(...args),
		};
	}, [sdk, loading, isAuthenticated, idTokenClaims, accessToken, refreshToken, accessTokenExpired, accessTokenExpirationDate]);

	return <STRIVACITY_SDK.Provider value={value}>{children}</STRIVACITY_SDK.Provider>;
}
