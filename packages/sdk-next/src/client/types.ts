import type { ReactNode, DetailedHTMLProps, HTMLAttributes } from 'react';
import type {
	LoginComponent,
	NotificationComponent,
	LandingComponent,
	LanguageSelectorComponent,
	SDKOptions,
	SDKInitConfig,
	SessionData,
	IdTokenClaims,
	RedirectFlow,
	PopupFlow,
	NativeFlow,
	EmbeddedFlow,
} from '@strivacity/sdk-core';

type ElementProps<T extends HTMLElement, Extra = object> = DetailedHTMLProps<
	Omit<HTMLAttributes<T>, keyof Extra> & Partial<Omit<T, keyof HTMLElement>> & Extra,
	T
>;

declare module 'react' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			'sty-login': ElementProps<
				LoginComponent,
				{
					// Custom events emitted by the web component
					onLogin?: () => void;
					onClose?: () => void;
					onError?: (e: CustomEvent<string>) => void;
				}
			>;
			'sty-notifications': ElementProps<NotificationComponent>;
			'sty-language-selector': ElementProps<LanguageSelectorComponent>;
			'sty-landing': ElementProps<LandingComponent>;
		}
	}
}

export type * from '@strivacity/sdk-core';

export type NextAuthProviderOptions = SDKOptions;

export type NextAuthProviderInitConfig = SDKInitConfig & Partial<NextAuthProviderOptions>;

export type AuthProviderProps = {
	/**
	 * The options to be used by the AuthProvider. These options are passed to the SDK during initialization.
	 *
	 * @type {NextAuthProviderInitConfig}
	 */
	options: NextAuthProviderInitConfig;

	/**
	 * The session data to be used by the AuthProvider. If not provided, the AuthProvider will attempt to retrieve the session data from the SDK.
	 *
	 * @type {SessionData | null}
	 * @default null
	 */
	session?: SessionData | null;

	/**
	 * The children to be rendered by the AuthProvider. This is typically the rest of your application.
	 *
	 * @type {ReactNode}
	 */
	children: ReactNode;
};

export type SDKContext<Flow extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow> = {
	/**
	 * The underlying Strivacity SDK flow instance.
	 *
	 * Only use this when you need to access functionality that is not exposed through the SDK's React context
	 * (e.g. low-level flow methods or properties not available as dedicated context fields).
	 * Prefer the dedicated context fields over accessing the SDK instance directly.
	 *
	 * @type {Flow}
	 */
	sdk: Flow;

	/**
	 * A boolean indicating whether the SDK is still loading. This can be used to show a loading spinner or similar UI while the SDK is initializing.
	 *
	 * @type {boolean}
	 */
	loading: boolean;

	/**
	 * BCP 47 language code representing the current language of the SDK.
	 *
	 * @type {string}
	 */
	language: string;

	/**
	 * A boolean indicating whether the user is authenticated. This can be used to conditionally render UI based on the user's authentication state.
	 *
	 * @type {boolean}
	 */
	isAuthenticated: boolean;

	/**
	 * The claims from the ID token, if available. This can be used to access user information and other claims provided by the authentication server.
	 *
	 * @type {IdTokenClaims | null}
	 */
	idTokenClaims: IdTokenClaims | null;

	/**
	 * The access token, if available. This can be used to authenticate API requests or other interactions with the backend.
	 *
	 * @type {string | null}
	 */
	accessToken: string | null;

	/**
	 * The refresh token, if available. This can be used to obtain new access tokens when the current one expires.
	 *
	 * @type {string | null}
	 */
	refreshToken: string | null;

	/**
	 * A boolean indicating whether the access token has expired. This can be used to trigger a refresh of the access token or to log the user out.
	 *
	 * @type {boolean}
	 */
	accessTokenExpired: boolean;

	/**
	 * The expiration date of the access token, if available. This can be used to determine when to refresh the access token or to log the user out.
	 *
	 * @type {number | null}
	 */
	accessTokenExpirationDate: number | null;

	/**
	 * Subscribes to a specific SDK event.
	 *
	 * @type {Flow['subscribeToEvent']}
	 */
	subscribeToEvent: Flow['subscribeToEvent'];

	/**
	 * Subscribes to all SDK events.
	 *
	 * @type {Flow['subscribeToAllEvents']}
	 */
	subscribeToAllEvents: Flow['subscribeToAllEvents'];

	/**
	 * Checks whether the user is currently authenticated, optionally triggering a token refresh.
	 *
	 * @type {Flow['checkAuthentication']}
	 */
	checkAuthentication: Flow['checkAuthentication'];

	/**
	 * Returns the current access token, optionally refreshing it if expired.
	 *
	 * @type {Flow['getAccessToken']}
	 */
	getAccessToken: Flow['getAccessToken'];

	/**
	 * Initializes the SDK, loading metadata and restoring any persisted session.
	 *
	 * @type {Flow['init']}
	 */
	init: Flow['init'];

	/**
	 * Performs a token exchange using the provided parameters.
	 *
	 * @type {Flow['tokenExchange']}
	 */
	tokenExchange: Flow['tokenExchange'];

	/**
	 * Handles the authentication callback by parsing the response from the given URL.
	 *
	 * @type {Flow['handleCallback']}
	 */
	handleCallback: Flow['handleCallback'];

	/**
	 * Refreshes the current access token using the refresh token.
	 *
	 * @type {Flow['refresh']}
	 */
	refresh: Flow['refresh'];

	/**
	 * Revokes the current tokens.
	 *
	 * @type {Flow['refresh']}
	 */
	revoke: Flow['revoke'];

	/**
	 * Logs the user out and optionally redirects to a post-logout URI.
	 *
	 * @type {Flow['refresh']}
	 */
	logout: Flow['logout'];

	/**
	 * Initiates the login flow.
	 *
	 * @type {Flow['refresh']}
	 */
	login: Flow['login'];

	/**
	 * Initiates the registration flow.
	 *
	 * @type {Flow['refresh']}
	 */
	register: Flow['register'];

	/**
	 * Handles the entry point URL of the authentication flow, typically used for embedded or native modes.
	 *
	 * @type {Flow['refresh']}
	 */
	entry: Flow['entry'];
} & (Flow extends EmbeddedFlow | NativeFlow
	? {
			/**
			 * Starts the login session. Only available for `embedded` and `native` flows.
			 *
			 * @type {Flow['startSession']}
			 */
			startSession: Flow['startSession'];

			/**
			 * Finalizes the login session by processing the callback URL. Only available for `embedded` and `native` flows.
			 *
			 * @type {Flow['finalizeSession']}
			 */
			finalizeSession: Flow['finalizeSession'];
		}
	: object) &
	(Flow extends NativeFlow
		? {
				/**
				 * Submits a login form with the given form ID and body data. Only available for `native` flows.
				 *
				 * @type {Flow['submitForm']}
				 */
				submitForm: Flow['submitForm'];
			}
		: object);
