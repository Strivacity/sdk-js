import { setContext, onDestroy } from 'svelte';
import { initFlow } from '@strivacity/sdk-core';
import type { IdTokenClaims, RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, SDKContext, SDKInstance, StyAuthProviderProps } from '../types';
import { STRIVACITY_SDK } from './hooks.svelte';

/**
 * Initializes the Strivacity SDK and stores its reactive state and methods in the Svelte context, so `useStrivacity()` can read them in every descendant component.
 * Call it during the initialization of a root component (e.g. the root `+layout.svelte`). The SDK is only created in the browser: during SSR `sdk` is `undefined` and `loading` stays `true`.
 *
 * @param {StyAuthProviderProps} props - The options and the optional session getter used to configure the SDK.
 * @param {SDKInitConfig} props.options - The configuration options for initializing the Strivacity SDK.
 * @param {() => SessionData | null | undefined} [props.session] - Optional getter for the session data the SDK is initialized and kept in sync with.
 *
 * @returns {SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow>} The context value that was set, the same object `useStrivacity()` returns.
 */
export function createStyAuthProvider(props: StyAuthProviderProps): SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow> {
	let sdk: SDKInstance;
	let subscriptions: ReturnType<SDKInstance['subscribeToAllEvents']> | null = null;

	let loading = $state<boolean>(true);
	let language = $state<string>(globalThis.navigator?.language ?? 'en-US');
	let isAuthenticated = $state<boolean>(false);
	let idTokenClaims = $state<IdTokenClaims | null>(null);
	let accessToken = $state<string | null>(null);
	let refreshToken = $state<string | null>(null);
	let accessTokenExpired = $state<boolean>(true);
	let accessTokenExpirationDate = $state<number | null>(null);

	const updateSession = async () => {
		const authenticated = await sdk.isAuthenticated;

		if (loading) {
			loading = false;
		}
		if (sdk.language !== language) {
			language = sdk.language;
		}
		if (authenticated !== isAuthenticated) {
			isAuthenticated = authenticated;
		}
		if (sdk.idTokenClaims !== idTokenClaims) {
			idTokenClaims = sdk.idTokenClaims || null;
		}
		if (sdk.accessToken !== accessToken) {
			accessToken = sdk.accessToken || null;
		}
		if (sdk.refreshToken !== refreshToken) {
			refreshToken = sdk.refreshToken || null;
		}
		if (sdk.accessTokenExpired !== accessTokenExpired) {
			accessTokenExpired = sdk.accessTokenExpired;
		}
		if (sdk.accessTokenExpirationDate !== accessTokenExpirationDate) {
			accessTokenExpirationDate = sdk.accessTokenExpirationDate || null;
		}
	};

	function onInit() {
		sdk = initFlow(props.options as never);
		subscriptions = sdk.subscribeToAllEvents(updateSession);

		$effect(() => {
			const session = props.session?.();

			if (session) {
				sdk.session = session;
			}

			void updateSession();
		});
	}

	onDestroy(() => {
		subscriptions?.dispose();
	});

	if (typeof window !== 'undefined') {
		onInit();
	}

	const contextValue: SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow> = {
		get sdk() {
			return sdk;
		},
		get loading() {
			return loading;
		},
		get language() {
			return language;
		},
		get isAuthenticated() {
			return isAuthenticated;
		},
		get idTokenClaims() {
			return idTokenClaims;
		},
		get accessToken() {
			return accessToken;
		},
		get refreshToken() {
			return refreshToken;
		},
		get accessTokenExpired() {
			return accessTokenExpired;
		},
		get accessTokenExpirationDate() {
			return accessTokenExpirationDate;
		},
		init: () => sdk.init(),
		subscribeToEvent: ((...args: Parameters<typeof sdk.subscribeToEvent>) => sdk.subscribeToEvent(...args)) as typeof sdk.subscribeToEvent,
		subscribeToAllEvents: (...args: Parameters<typeof sdk.subscribeToAllEvents>) => sdk.subscribeToAllEvents(...args),
		checkAuthentication: (...args: Parameters<typeof sdk.checkAuthentication>) => sdk.checkAuthentication(...args),
		tokenExchange: (...args: Parameters<typeof sdk.tokenExchange>) => sdk.tokenExchange(...args),
		handleCallback: (...args: Parameters<typeof sdk.handleCallback>) => sdk.handleCallback(...args),
		refresh: (...args: Parameters<typeof sdk.refresh>) => sdk.refresh(...args),
		revoke: () => sdk.revoke(),
		logout: (...args: Parameters<typeof sdk.logout>) => sdk.logout(...args),
		login: (...args: Parameters<typeof sdk.login>) => sdk.login(...args),
		register: (...args: Parameters<typeof sdk.register>) => sdk.register(...args),
		entry: (...args: Parameters<typeof sdk.entry>) => sdk.entry(...args),
	};

	setContext(STRIVACITY_SDK, contextValue);

	return contextValue;
}
