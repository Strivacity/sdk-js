import type { EmbeddedFlow, IdTokenClaims, NativeFlow, PopupFlow, RedirectFlow } from '@strivacity/sdk-core/types';
import type { SDKContext } from '../types';
import { ref } from 'vue';
import { initFlow } from '@strivacity/sdk-core';
import { useRuntimeConfig } from '#app';
import { useSession } from './use-session';
import createLogging from '#strivacity-options-logging';
import createHttpClient from '#strivacity-options-httpClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any;

const loadingRef = ref<boolean>(true);
const languageRef = ref<string>(globalThis.navigator?.language ?? 'en-US');
const isAuthenticatedRef = ref<boolean>(false);
const idTokenClaimsRef = ref<IdTokenClaims | null>(null);
const accessTokenRef = ref<string | null>(null);
const refreshTokenRef = ref<string | null>(null);
const accessTokenExpiredRef = ref<boolean>(true);
const accessTokenExpirationDateRef = ref<number | null>(null);

const updateSession = async () => {
	const authenticated = await sdk.isAuthenticated;

	if (loadingRef.value) {
		loadingRef.value = false;
	}
	if (sdk.language !== languageRef.value) {
		languageRef.value = sdk.language;
	}
	if (authenticated !== isAuthenticatedRef.value) {
		isAuthenticatedRef.value = authenticated;
	}
	if (sdk.idTokenClaims !== idTokenClaimsRef.value) {
		idTokenClaimsRef.value = sdk.idTokenClaims || null;
	}
	if (sdk.accessToken !== accessTokenRef.value) {
		accessTokenRef.value = sdk.accessToken || null;
	}
	if (sdk.refreshToken !== refreshTokenRef.value) {
		refreshTokenRef.value = sdk.refreshToken || null;
	}
	if (sdk.accessTokenExpired !== accessTokenExpiredRef.value) {
		accessTokenExpiredRef.value = sdk.accessTokenExpired;
	}
	if (sdk.accessTokenExpirationDate !== accessTokenExpirationDateRef.value) {
		accessTokenExpirationDateRef.value = sdk.accessTokenExpirationDate || null;
	}
};

/**
 * A composable to access the Strivacity SDK context.
 *
 * @template T - The type of the Strivacity SDK flow (RedirectFlow, PopupFlow, NativeFlow, or EmbeddedFlow).
 * @returns {SDKContext<T>} The Strivacity SDK context.
 */
export const useStrivacity = <
	T extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow,
>(): SDKContext<T> => {
	if (!sdk) {
		sdk = initFlow({
			...useRuntimeConfig().public.strivacity,
			logging: createLogging ? createLogging() : undefined,
			httpClient: createHttpClient ? createHttpClient() : undefined,
		});
		sdk.subscribeToAllEvents(updateSession);

		sdk.session = useSession().value;
		void updateSession();
	}

	return {
		sdk,
		loading: loadingRef,
		language: languageRef,
		isAuthenticated: isAuthenticatedRef,
		idTokenClaims: idTokenClaimsRef,
		accessToken: accessTokenRef,
		refreshToken: refreshTokenRef,
		accessTokenExpired: accessTokenExpiredRef,
		accessTokenExpirationDate: accessTokenExpirationDateRef,
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
};
