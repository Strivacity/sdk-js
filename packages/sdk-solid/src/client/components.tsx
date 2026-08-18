import type { JSX } from '@solidjs/web';
import type { IdTokenClaims, RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow, SDKContext, SDKInstance, StyAuthProviderProps } from './types';
import { createSignal, onSettled } from 'solid-js';
import { initFlow } from '@strivacity/sdk-core';
import { STRIVACITY_SDK } from './hooks';

/**
 * Initializes the Strivacity SDK and provides its reactive session state to descendants via context. Mount it once, near the root of your app.
 *
 * @param {StyAuthProviderProps} props - The options and initial session data used to configure the SDK, plus the children to render.
 */
export function StyAuthProvider(props: StyAuthProviderProps): JSX.Element {
	let sdk: SDKInstance;

	const [loading, setLoading] = createSignal<boolean>(true);
	const [language, setLanguage] = createSignal<string>(globalThis.navigator?.language ?? 'en-US');
	const [isAuthenticated, setIsAuthenticated] = createSignal<boolean>(false);
	const [idTokenClaims, setIdTokenClaims] = createSignal<IdTokenClaims | null>(null);
	const [accessToken, setAccessToken] = createSignal<string | null>(null);
	const [refreshToken, setRefreshToken] = createSignal<string | null>(null);
	const [accessTokenExpired, setAccessTokenExpired] = createSignal<boolean>(true);
	const [accessTokenExpirationDate, setAccessTokenExpirationDate] = createSignal<number | null>(null);

	async function updateSession(): Promise<void> {
		const authenticated = await sdk.isAuthenticated;

		if (loading()) {
			setLoading(false);
		}
		if (sdk.language !== language()) {
			setLanguage(sdk.language);
		}
		if (authenticated !== isAuthenticated()) {
			setIsAuthenticated(authenticated);
		}
		if (sdk.idTokenClaims !== idTokenClaims()) {
			setIdTokenClaims(sdk.idTokenClaims || null);
		}
		if (sdk.accessToken !== accessToken()) {
			setAccessToken(sdk.accessToken || null);
		}
		if (sdk.refreshToken !== refreshToken()) {
			setRefreshToken(sdk.refreshToken || null);
		}
		if (sdk.accessTokenExpired !== accessTokenExpired()) {
			setAccessTokenExpired(sdk.accessTokenExpired);
		}
		if (sdk.accessTokenExpirationDate !== accessTokenExpirationDate()) {
			setAccessTokenExpirationDate(sdk.accessTokenExpirationDate || null);
		}
	}

	onSettled(() => {
		sdk = initFlow(props.options as never);
		const sdkEvents = sdk.subscribeToAllEvents(updateSession);

		if (props.session) {
			sdk.session = props.session;
		}

		void updateSession();

		return () => {
			sdkEvents.dispose();
		};
	});

	const value: SDKContext<RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow> = {
		get sdk() {
			return sdk;
		},
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
		tokenExchange: (...args: Parameters<typeof sdk.tokenExchange>) => sdk.tokenExchange(...args),
		handleCallback: (...args: Parameters<typeof sdk.handleCallback>) => sdk.handleCallback(...args),
		refresh: () => sdk.refresh(),
		revoke: () => sdk.revoke(),
		logout: (...args: Parameters<typeof sdk.logout>) => sdk.logout(...args),
		login: (...args: Parameters<typeof sdk.login>) => sdk.login(...args),
		register: (...args: Parameters<typeof sdk.register>) => sdk.register(...args),
		entry: (...args: Parameters<typeof sdk.entry>) => sdk.entry(...args),
	};

	return <STRIVACITY_SDK value={value}>{props.children}</STRIVACITY_SDK>;
}
