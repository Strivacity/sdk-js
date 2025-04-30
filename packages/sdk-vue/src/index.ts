import { type App, inject, ref } from 'vue';
import { initFlow, type IdTokenClaims, type SDKOptions } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import { LocalStorage } from '@strivacity/sdk-core/storages/LocalStorage';
import { SessionStorage } from '@strivacity/sdk-core/storages/SessionStorage';
import LoginRendererComponent from './components/login-renderer.vue';
import type { PopupContext, RedirectContext, NativeContext } from './types';

export * from '@strivacity/sdk-core';
export type * from './types';
export type { PopupFlow, RedirectFlow, NativeFlow };
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
 * @template T The type of context, either PopupContext, RedirectContext or NativeContext.
 *
 * @throws {Error} If the Strivacity SDK context is not found.
 *
 * @returns {T} The Strivacity SDK context, typed as either PopupContext, RedirectContext or NativeContext.
 */
export const useStrivacity = <T extends PopupContext | RedirectContext | NativeContext>() => {
	const context = inject(STRIVACITY_SDK);

	if (!context) {
		throw new Error('Missing Strivacity SDK context');
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
			const optionsRef = ref<SDKOptions>(sdk.options);
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

			app.component('StyLoginRenderer', LoginRendererComponent);
			app.provide(STRIVACITY_SDK, {
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
			});
		},
	};

	return plugin;
};
