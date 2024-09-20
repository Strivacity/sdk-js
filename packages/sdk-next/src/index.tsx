import { type FC, createContext, useContext, useMemo, useEffect, useState } from 'react';
import { initFlow, type SDKOptions, type SDKStorage, type IdTokenClaims } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { LocalStorage } from '@strivacity/sdk-core/storages/LocalStorage';
import { SessionStorage } from '@strivacity/sdk-core/storages/SessionStorage';
import type { Session, PopupContext, PopupSDK, RedirectContext, RedirectSDK, Children } from './types';

export type { SDKOptions, SDKStorage, Session, IdTokenClaims, PopupFlow, RedirectFlow, PopupContext, PopupSDK, RedirectContext, RedirectSDK };
export { LocalStorage, SessionStorage };

const StrivacitySdk = createContext<PopupContext | RedirectContext>(null!);

let sdk: RedirectFlow | PopupFlow;

/**
 * Hook to access the Strivacity SDK context
 *
 * @template T Extends either PopupContext or RedirectContext.
 *
 * @returns {T} The current Strivacity SDK context.
 *
 * @throws {Error} If the context is not provided by an AuthProvider.
 */
export const useStrivacity = <T extends PopupContext | RedirectContext>() => {
	const context = useContext(StrivacitySdk);

	if (!context) {
		throw Error('Missing Strivacity SDK context');
	}

	return context as T;
};

/**
 * Strivacity authentication provider component
 *
 * @param {SDKOptions} options - The SDK configuration options.
 * @param {Children} [children] - The child components wrapped by the provider.
 *
 * @returns {JSX.Element} A provider that passes the Strivacity SDK context to its children.
 */
export const AuthProvider: FC<{ options: SDKOptions; children?: Children }> = ({
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

	const value = useMemo<PopupContext | RedirectContext>(() => {
		if (!sdk) {
			sdk = initFlow(options);
		}

		return {
			loading,
			isAuthenticated,
			idTokenClaims,
			accessToken,
			refreshToken,
			accessTokenExpired,
			accessTokenExpirationDate,

			login: async (options?: Parameters<PopupFlow['login'] | RedirectFlow['login']>[0]) => {
				await sdk.login(options);
				await updateSession();
			},
			register: async (options?: Parameters<PopupFlow['register'] | RedirectFlow['register']>[0]) => {
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
			handleCallback: async (url?: Parameters<PopupFlow['handleCallback'] | RedirectFlow['handleCallback']>[0]) => {
				await sdk.handleCallback(url);
				await updateSession();
			},
		};
	}, [loading, idTokenClaims, accessToken, refreshToken, accessTokenExpired, accessTokenExpirationDate, isAuthenticated]);

	useEffect(() => {
		if (!sdk) {
			return;
		}

		void updateSession();

		sdk.subscribeToEvent('init', updateSession);
		sdk.subscribeToEvent('loggedIn', updateSession);
		sdk.subscribeToEvent('sessionLoaded', updateSession);
		sdk.subscribeToEvent('tokenRefreshed', updateSession);
		sdk.subscribeToEvent('tokenRefreshFailed', updateSession);
		sdk.subscribeToEvent('logoutInitiated', updateSession);
		sdk.subscribeToEvent('tokenRevoked', updateSession);
		sdk.subscribeToEvent('tokenRevokeFailed', updateSession);
	}, []);

	return <StrivacitySdk.Provider value={value}>{children}</StrivacitySdk.Provider>;
};
