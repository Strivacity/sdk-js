import type { ComponentChildren } from 'preact';
import type {
	LoginComponent,
	NotificationComponent,
	LandingComponent,
	LanguageSelectorComponent,
	SDKInitConfig,
	SessionData,
	IdTokenClaims,
	RedirectFlow,
	PopupFlow,
	NativeFlow,
	EmbeddedFlow,
	initFlow,
	NativeFlowState,
	NativeParams,
	NativeFlowMessage,
} from '@strivacity/sdk-core';
import type { FallbackError } from '@strivacity/sdk-core/utils';

export * from '@strivacity/sdk-core/types';

declare module 'preact' {
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

export type ElementProps<T extends HTMLElement, Extra = object> = preact.JSX.HTMLAttributes<T> & Partial<Omit<T, keyof HTMLElement>> & Extra;

export type SDKContext<Flow extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow> = {
	/**
	 * The underlying Strivacity SDK flow instance.
	 */
	readonly sdk: Flow;

	/**
	 * A boolean indicating whether the SDK is still loading. This can be used to show a loading spinner or similar UI while the SDK is initializing.
	 */
	readonly loading: boolean;

	/**
	 * BCP 47 language code representing the current language of the SDK.
	 */
	readonly language: string;

	/**
	 * A boolean indicating whether the user is authenticated. This can be used to conditionally render UI based on the user's authentication state.
	 */
	readonly isAuthenticated: boolean;

	/**
	 * The claims from the ID token, if available. This can be used to access user information and other claims provided by the authentication server.
	 */
	readonly idTokenClaims: IdTokenClaims | null;

	/**
	 * The access token, if available. This can be used to authenticate API requests or other interactions with the backend.
	 */
	readonly accessToken: string | null;

	/**
	 * The refresh token, if available. This can be used to obtain new access tokens when the current one expires.
	 */
	readonly refreshToken: string | null;

	/**
	 * A boolean indicating whether the access token has expired. This can be used to trigger a refresh of the access token or to log the user out.
	 */
	readonly accessTokenExpired: boolean;

	/**
	 * The expiration date of the access token, if available. This can be used to determine when to refresh the access token or to log the user out.
	 */
	readonly accessTokenExpirationDate: number | null;

	/**
	 * Subscribes to a specific SDK event.
	 */
	subscribeToEvent: Flow['subscribeToEvent'];

	/**
	 * Subscribes to all SDK events.
	 */
	subscribeToAllEvents: Flow['subscribeToAllEvents'];

	/**
	 * Checks whether the user is currently authenticated, optionally triggering a token refresh.
	 */
	checkAuthentication: Flow['checkAuthentication'];

	/**
	 * Initializes the SDK, loading metadata and restoring any persisted session.
	 */
	init: Flow['init'];

	/**
	 * Performs a token exchange using the provided parameters.
	 */
	tokenExchange: Flow['tokenExchange'];

	/**
	 * Handles the authentication callback by parsing the response from the given URL.
	 */
	handleCallback: Flow['handleCallback'];

	/**
	 * Refreshes the current access token using the refresh token.
	 */
	refresh: Flow['refresh'];

	/**
	 * Revokes the current tokens.
	 */
	revoke: Flow['revoke'];

	/**
	 * Logs the user out and optionally redirects to a post-logout URI.
	 */
	logout: Flow['logout'];

	/**
	 * Initiates the login flow.
	 */
	login: Flow['login'];

	/**
	 * Initiates the registration flow.
	 */
	register: Flow['register'];

	/**
	 * Handles the entry point URL of the authentication flow, typically used for embedded or native modes.
	 */
	entry: Flow['entry'];
};

export type SDKInstance = ReturnType<typeof initFlow>;

export type StyAuthProviderProps = {
	/**
	 * The options to be used by the AuthProvider. These options are passed to the SDK during initialization.
	 */
	options: SDKInitConfig;

	/**
	 * The session data to be used by the AuthProvider.
	 *
	 * If not provided, the AuthProvider will attempt to retrieve the session data from the SDK.
	 */
	session?: SessionData | null;

	/**
	 * The children to be rendered by the AuthProvider. This is typically the rest of your application.
	 */
	children: ComponentChildren;
};

export type LoginContext = {
	/**
	 * Whether a form submission or session initialization is in progress.
	 */
	loading: boolean;

	/**
	 * Current form field values, keyed by form ID then widget ID.
	 */
	forms: Record<string, Record<string, unknown>>;

	/**
	 * Current validation and info messages, keyed by form ID then widget ID.
	 */
	messages: Record<string, Record<string, NativeFlowMessage>>;

	/**
	 * The current login flow state returned by the backend.
	 */
	state: Partial<NativeFlowState>;

	/**
	 * Submits the form with the given ID and advances the login flow.
	 *
	 * @param formId - The ID of the form to submit.
	 * @param customBody - Optional custom body to send with the form submission. If not provided, the current form values will be used.
	 * @returns A promise that resolves when the form submission is complete.
	 */
	submitForm: (formId: string, customBody?: Record<string, unknown>) => Promise<void>;

	/**
	 * Redirects to the hosted login UI.
	 *
	 * @param message - Optional message to log before redirecting.
	 * @returns A promise that resolves when the redirect is initiated.
	 */
	triggerFallback: (message?: string) => void;

	/**
	 * Signals that the login flow was closed by the user.
	 */
	triggerClose: () => void;

	/**
	 * Updates a single field value within a form before submission.
	 *
	 * @param formId - The ID of the form containing the field.
	 * @param widgetId - The ID of the widget (field) to update.
	 * @param value - The new value to set for the field.
	 */
	setFormValue: (formId: string, widgetId: string, value: unknown) => void;

	/**
	 * Sets a validation or info message on a specific widget.
	 *
	 * @param formId - The ID of the form containing the widget.
	 * @param widgetId - The ID of the widget to set the message for.
	 * @param value - The message to set, which can be a string or a structured NativeFlowMessage.
	 */
	setMessage: (formId: string, widgetId: string, value: NativeFlowMessage) => void;
};

export type UseNativeLoginOptions = {
	/**
	 * Optional parameters to be passed to the login session request.
	 */
	params?: NativeParams;

	/**
	 * Called when the user successfully completes the login flow.
	 */
	onLogin?: (session: SessionData) => void | Promise<void>;

	/**
	 * Called when the fallback flow is triggered.
	 */
	onFallback?: (error: FallbackError) => void | Promise<void>;

	/**
	 * Called when the login flow is closed by the user.
	 */
	onClose?: () => void | Promise<void>;

	/**
	 * Called when an error occurs during login flow initialization or submission.
	 */
	onError?: (error: Error) => void | Promise<void>;

	/**
	 * Called when a global message is received during the login flow.
	 */
	onGlobalMessage?: (message: NativeFlowMessage) => void | Promise<void>;
};

export type WithAuthGuardOptions = {
	/**
	 * The URL to redirect the user to if they are not authenticated.
	 *
	 * @default '/login'
	 */
	loginUri?: string;

	/**
	 * A component to render while the authentication state is being determined. Defaults to `null`.
	 */
	onLoading?: () => React.ReactNode;
};
