import StorageClass from '#build/strivacity-sdk-storage';
import { ref, useRuntimeConfig } from '#imports';
import { initFlow, type IdTokenClaims } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { PopupContext, RedirectContext } from '../types';

const loadingRef = ref<boolean>(false);
const isAuthenticatedRef = ref<boolean>(false);
const idTokenClaimsRef = ref<IdTokenClaims | null>(null);
const accessTokenRef = ref<string | null>(null);
const refreshTokenRef = ref<string | null>(null);
const accessTokenExpiredRef = ref<boolean>(true);
const accessTokenExpirationDateRef = ref<number | null>(null);
let sdk: PopupFlow | RedirectFlow;

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
	if (!sdk) {
		sdk = initFlow({ ...useRuntimeConfig().public.strivacity, storage: StorageClass });

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
	} as T;
};
