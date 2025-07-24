import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { initFlow } from '@strivacity/sdk-core';
import type { SDKOptions, IdTokenClaims } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import type { PopupContext, RedirectContext, NativeContext, Children } from './types';
import { STRIVACITY_SDK } from './composables';

let sdk: RedirectFlow | PopupFlow | NativeFlow;

export const StyAuthProvider: FC<{ options: SDKOptions; children?: Children }> = ({
	options,
	children = undefined,
}: {
	options: SDKOptions;
	children?: Children;
}) => {
	const [loading, setLoading] = useState<boolean>(true);
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [idTokenClaims, setIdTokenClaims] = useState<IdTokenClaims | null>(null);
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [refreshToken, setRefreshToken] = useState<string | null>(null);
	const [accessTokenExpired, setAccessTokenExpired] = useState<boolean>(true);
	const [accessTokenExpirationDate, setAccessTokenExpirationDate] = useState<number | null>(null);

	const updateSession = async () => {
		setIsAuthenticated(await sdk.isAuthenticated);
		setIdTokenClaims(sdk.idTokenClaims || null);
		setAccessToken(sdk.accessToken || null);
		setRefreshToken(sdk.refreshToken || null);
		setAccessTokenExpired(sdk.accessTokenExpired);
		setAccessTokenExpirationDate(sdk.accessTokenExpirationDate || null);

		if (loading) {
			setLoading(false);
		}
	};

	// @ts-expect-error: Ignore SDK type mismatch for initFlow
	const value = useMemo<PopupContext | RedirectContext | NativeContext>(() => {
		if (!sdk) {
			sdk = initFlow(options);

			sdk.subscribeToEvent('init', updateSession);
			sdk.subscribeToEvent('loggedIn', updateSession);
			sdk.subscribeToEvent('sessionLoaded', updateSession);
			sdk.subscribeToEvent('tokenRefreshed', updateSession);
			sdk.subscribeToEvent('tokenRefreshFailed', updateSession);
			sdk.subscribeToEvent('logoutInitiated', updateSession);
			sdk.subscribeToEvent('tokenRevoked', updateSession);
			sdk.subscribeToEvent('tokenRevokeFailed', updateSession);
		}

		return {
			sdk,
			loading,
			options,
			isAuthenticated,
			idTokenClaims,
			accessToken,
			refreshToken,
			accessTokenExpired,
			accessTokenExpirationDate,

			login: async (options?: Parameters<PopupFlow['login'] | RedirectFlow['login'] | NativeFlow['login']>[0]) => {
				if (sdk.options.mode === 'native') {
					return sdk.login(options);
				}

				await sdk.login(options);
				await updateSession();
			},
			register: async (options?: Parameters<PopupFlow['register'] | RedirectFlow['register'] | NativeFlow['register']>[0]) => {
				if (sdk.options.mode === 'native') {
					return sdk.register(options);
				}

				await sdk.register(options);
				await updateSession();
			},
			refresh: async () => {
				await sdk.refresh();
				await updateSession();
			},
			revoke: async () => {
				await sdk.revoke();
				await updateSession();
			},
			logout: async (options?: Parameters<PopupFlow['logout'] | RedirectFlow['logout']>[0]) => {
				await sdk.logout(options);
				await updateSession();
			},
			handleCallback: async (url?: Parameters<PopupFlow['handleCallback'] | RedirectFlow['handleCallback'] | NativeFlow['handleCallback']>[0]) => {
				await sdk.handleCallback(url);
				await updateSession();
			},
		};
	}, [sdk, loading, options, idTokenClaims, accessToken, refreshToken, accessTokenExpired, accessTokenExpirationDate, isAuthenticated]);

	return <STRIVACITY_SDK.Provider value={value}>{children}</STRIVACITY_SDK.Provider>;
};
