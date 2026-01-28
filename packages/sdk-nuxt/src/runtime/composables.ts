import StorageClass from '#build/strivacity-sdk-storage';
import LoggingClass from '#build/strivacity-sdk-logging';
import { ref, useRuntimeConfig } from '#imports';
import { initFlow, type IdTokenClaims, type SDKOptions } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import type { PopupContext, RedirectContext, NativeContext } from '../types';

export { createCredential, getCredential } from '@strivacity/sdk-core/utils/credentials';

const loadingRef = ref<boolean>(true);
const optionsRef = ref<SDKOptions>({} as SDKOptions);
const isAuthenticatedRef = ref<boolean>(false);
const idTokenClaimsRef = ref<IdTokenClaims | null>(null);
const accessTokenRef = ref<string | null>(null);
const refreshTokenRef = ref<string | null>(null);
const accessTokenExpiredRef = ref<boolean>(true);
const accessTokenExpirationDateRef = ref<number | null>(null);
let sdk: PopupFlow | RedirectFlow | NativeFlow;

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
 * @returns {T} The Strivacity SDK context, typed as either PopupContext or RedirectContext or NativeContext.
 */
export const useStrivacity = <T extends PopupContext | RedirectContext | NativeContext>() => {
	if (!sdk) {
		sdk = initFlow({ ...useRuntimeConfig().public.strivacity, storage: StorageClass, logging: LoggingClass });
		optionsRef.value = sdk.options;

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
		sdk: sdk,
		loading: loadingRef,
		options: optionsRef,
		isAuthenticated: isAuthenticatedRef,
		idTokenClaims: idTokenClaimsRef,
		accessToken: accessTokenRef,
		refreshToken: refreshTokenRef,
		accessTokenExpired: accessTokenExpiredRef,
		accessTokenExpirationDate: accessTokenExpirationDateRef,

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
		entry: async (url?: string) => {
			return await sdk.entry(url);
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
	} as T;
};
