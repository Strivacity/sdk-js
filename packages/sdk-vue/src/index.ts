import { type App, inject, ref } from 'vue';
import { initFlow, type SDKOptions, type SDKStorage, type IdTokenClaims } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { LocalStorage } from '@strivacity/sdk-core/storages/LocalStorage';
import { SessionStorage } from '@strivacity/sdk-core/storages/SessionStorage';
import type { Session, PopupContext, PopupSDK, RedirectContext, RedirectSDK } from './types';

export type { SDKOptions, SDKStorage, Session, IdTokenClaims, PopupFlow, RedirectFlow, PopupContext, RedirectContext, PopupSDK, RedirectSDK };
export { LocalStorage, SessionStorage };

const STRIVACITY_SDK = Symbol('sty');

/**
 * Checks if the user is authenticated.
 *
 * @returns {Promise<boolean>} A promise that resolves to `true` if the user is authenticated, otherwise `false`.
 */
export let isAuthenticated: () => Promise<boolean> = () => Promise.resolve(false);

/**
 * Retrieves the Strivacity SDK context for Popup or Redirect flows.
 *
 * @template T The type of context, either PopupContext or RedirectContext.
 *
 * @throws {Error} If the Strivacity SDK context is not found.
 *
 * @returns {T} The Strivacity SDK context, typed as either PopupContext or RedirectContext.
 */
export const useStrivacity = <T extends PopupContext | RedirectContext>() => {
	const context = inject(STRIVACITY_SDK);

	if (!context) {
		throw Error('Missing Strivacity SDK context');
	}

	return context as T;
};

/**
 * Creates a Strivacity SDK plugin for Vue.
 *
 * @param {SDKOptions} options - The options used to configure the SDK.
 *
 * @returns {Plugin} A Vue plugin that can be installed in the application.
 */
export const createStrivacitySDK = (options: SDKOptions) => {
	const sdk = initFlow(options);

	const plugin = {
		install: (app: App) => {
			const loadingRef = ref<boolean>(true);
			const isAuthenticatedRef = ref<boolean>(false);
			const idTokenClaimsRef = ref<IdTokenClaims | null>(null);
			const accessTokenRef = ref<string | null>(null);
			const refreshTokenRef = ref<string | null>(null);
			const accessTokenExpiredRef = ref<boolean>(true);
			const accessTokenExpirationDateRef = ref<number | null>(null);

			const updateSession = async () => {
				isAuthenticatedRef.value = await sdk.isAuthenticated;
				idTokenClaimsRef.value = sdk.idTokenClaims || null;
				accessTokenRef.value = sdk.accessToken || null;
				refreshTokenRef.value = sdk.refreshToken || null;
				accessTokenExpiredRef.value = sdk.accessTokenExpired;
				accessTokenExpirationDateRef.value = sdk.accessTokenExpirationDate || null;

				if (loadingRef.value) {
					loadingRef.value = false;
				}
			};

			isAuthenticated = () => sdk.isAuthenticated;

			sdk.subscribeToEvent('init', updateSession);
			sdk.subscribeToEvent('loggedIn', updateSession);
			sdk.subscribeToEvent('sessionLoaded', updateSession);
			sdk.subscribeToEvent('tokenRefreshed', updateSession);
			sdk.subscribeToEvent('tokenRefreshFailed', updateSession);
			sdk.subscribeToEvent('logoutInitiated', updateSession);
			sdk.subscribeToEvent('tokenRevoked', updateSession);
			sdk.subscribeToEvent('tokenRevokeFailed', updateSession);

			app.provide(STRIVACITY_SDK, {
				loading: loadingRef,
				isAuthenticated: isAuthenticatedRef,
				idTokenClaims: idTokenClaimsRef,
				accessToken: accessTokenRef,
				refreshToken: refreshTokenRef,
				accessTokenExpired: accessTokenExpiredRef,
				accessTokenExpirationDate: accessTokenExpirationDateRef,

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
			});
		},
	};

	return plugin;
};
