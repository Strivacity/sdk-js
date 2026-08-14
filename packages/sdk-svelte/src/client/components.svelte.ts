import { setContext, onDestroy } from 'svelte';
import { initFlow } from '@strivacity/sdk-core';
import type { IdTokenClaims, RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, SDKContext, SDKInstance, StyAuthProviderProps } from '../types';
import { STRIVACITY_SDK } from './hooks.svelte';

/**
 * The `StyAuthProvider` component is a Svelte context provider that initializes the Strivacity SDK and provides its state and methods to the rest of the application.
 *
 * @param {StyAuthProviderProps} props - The properties for the `StyAuthProvider` component.
 * @param {SDKInitConfig} props.options - The configuration options for initializing the Strivacity SDK.
 * @param {() => SessionData | null | undefined} [props.session] - Optional getter for session data to initialize/refresh the SDK with.
 *
 * @returns {SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow>} A Svelte context provider that wraps its children and provides access to the Strivacity SDK.
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

	if (typeof window !== 'undefined') {
		sdk = initFlow(props.options as never) as unknown as SDKInstance;
		subscriptions = sdk.subscribeToAllEvents(updateSession);

		// Tracked reactively so a session re-hydrated by a SvelteKit `load()` re-run (e.g. after `invalidateAll()`) is picked up, not just the value seen at init.
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

	setContext(STRIVACITY_SDK, contextValue);

	return contextValue;
}
