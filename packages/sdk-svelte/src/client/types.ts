import type {
	IdTokenClaims,
	RedirectFlow,
	PopupFlow,
	NativeFlow,
	EmbeddedFlow,
	initFlow,
	FallbackError,
	NativeParams,
	LoginFlowState,
	SessionData,
	LoginFlowMessage,
	SDKInitConfig,
} from '@strivacity/sdk-core';

export * from '@strivacity/sdk-core/types';

export type SDKContext<Flow extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow> = {
	/**
	 * The underlying Strivacity SDK flow instance.
	 */
	readonly sdk: Flow;

	/**
	 * A boolean indicating whether the SDK is still loading.
	 */
	readonly loading: boolean;

	/**
	 * BCP 47 language code representing the current language of the SDK.
	 */
	readonly language: string;

	/**
	 * A boolean ref indicating whether the user is authenticated.
	 */
	readonly isAuthenticated: boolean;

	/**
	 * The claims from the ID token, if available.
	 */
	readonly idTokenClaims: IdTokenClaims | null;

	/**
	 * The access token, if available.
	 */
	readonly accessToken: string | null;

	/**
	 * The refresh token, if available.
	 */
	readonly refreshToken: string | null;

	/**
	 * A boolean ref indicating whether the access token has expired.
	 */
	readonly accessTokenExpired: boolean;

	/**
	 * The expiration date of the access token, if available.
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
	 * Returns the current access token, optionally refreshing it if expired.
	 */
	getAccessToken: Flow['getAccessToken'];

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

export type SDKInstance = Awaited<ReturnType<typeof initFlow>>;

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
	messages: Record<string, Record<string, LoginFlowMessage>>;

	/**
	 * The current login flow state returned by the backend.
	 */
	state: Partial<LoginFlowState>;

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
	 * @param value - The message to set, which can be a string or a structured LoginFlowMessage.
	 */
	setMessage: (formId: string, widgetId: string, value: LoginFlowMessage) => void;
};

export type StyAuthProviderProps = {
	/**
	 * The options to be used by the AuthProvider. These options are passed to the SDK during initialization.
	 */
	options: SDKInitConfig;

	/**
	 * A getter returning the session data to be used by the AuthProvider.
	 *
	 * Called reactively (inside a Svelte effect) whenever the returned value changes, so it should read from a
	 * reactive source (e.g. a `$props()` field) rather than a plain snapshot. If not provided, the AuthProvider
	 * will attempt to retrieve the session data from the SDK.
	 */
	session?: () => SessionData | null | undefined;
};

/**
 * The reactive context value exposed to native login flow widgets via `useNativeLoginContext()` (key: `nativeFlowContext`).
 */
export type NativeFlowContextValue = {
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
	messages: Record<string, Record<string, LoginFlowMessage>>;

	/**
	 * The current login flow state returned by the backend.
	 */
	state: Partial<LoginFlowState>;

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
	 * @param value - The message to set.
	 */
	setMessage: (formId: string, widgetId: string, value: LoginFlowMessage) => void;
};

export type UseNativeLoginOptions = {
	/**
	 * Optional parameters to be passed to the login session request. These parameters will be sent to the `authorizationUri` endpoint.
	 */
	params?: NativeParams;

	/**
	 * Called when the user successfully completes the login flow.
	 */
	onLogin?: (session: SessionData) => void | Promise<void>;

	/**
	 * Called when the fallback flow is triggered, typically due to an error or unsupported environment. Receives a `FallbackError` object containing the hosted URL to redirect to.
	 */
	onFallback?: (error: FallbackError) => void | Promise<void>;

	/**
	 * Called when the login flow is closed by the user.
	 */
	onClose?: () => void | Promise<void>;

	/**
	 * Called when an error occurs during the login session initialization or flow.
	 */
	onError?: (error: Error) => void | Promise<void>;

	/**
	 * Called when a global message is received during the login flow.
	 */
	onGlobalMessage?: (message: LoginFlowMessage) => void | Promise<void>;
};
