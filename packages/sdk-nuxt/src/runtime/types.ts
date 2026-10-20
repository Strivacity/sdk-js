import type { H3Event } from 'h3';
import type { Ref } from 'vue';
import type {
	ServerSDKOptions,
	ServerSDKInitConfig,
	SDKStorage,
	CookieOptions,
	IdTokenClaims,
	RedirectFlow,
	PopupFlow,
	NativeFlow,
	EmbeddedFlow,
	NativeFlowMessage,
	initFlow,
	NativeFlowState,
	LogoutTokenClaims,
	BaseServerSDK,
	NativeLoginControllerOptions,
} from '@strivacity/sdk-core';

declare module '@nuxt/schema' {
	interface RuntimeConfig {
		strivacity: StrivacityRuntimeConfig;
	}

	interface PublicRuntimeConfig {
		strivacity: StrivacityPublicRuntimeConfig;
	}
}

export * from '@strivacity/sdk-core/types';

export type StrivacityRuntimeConfig = NuxtServerSDKInitConfig;

export type StrivacityPublicRuntimeConfig = Omit<
	NuxtServerSDKInitConfig,
	'cookieSecret' | 'storageFactoryPath' | 'stateStorageFactoryPath' | 'loggingFactoryPath' | 'httpClientFactoryPath'
>;

export type SDKContext<Flow extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow> = {
	/**
	 * The underlying Strivacity SDK flow instance.
	 */
	readonly sdk: Flow;

	/**
	 * A boolean indicating whether the SDK is still loading.
	 */
	readonly loading: Ref<boolean>;

	/**
	 * BCP 47 language code representing the current language of the SDK.
	 */
	readonly language: Ref<string>;

	/**
	 * A boolean ref indicating whether the user is authenticated.
	 */
	readonly isAuthenticated: Ref<boolean>;

	/**
	 * The claims from the ID token, if available.
	 */
	readonly idTokenClaims: Ref<IdTokenClaims | null>;

	/**
	 * The access token, if available.
	 */
	readonly accessToken: Ref<string | null>;

	/**
	 * The refresh token, if available.
	 */
	readonly refreshToken: Ref<string | null>;

	/**
	 * A boolean ref indicating whether the access token has expired.
	 */
	readonly accessTokenExpired: Ref<boolean>;

	/**
	 * The expiration date of the access token, if available.
	 */
	readonly accessTokenExpirationDate: Ref<number | null>;

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

export type LoginContext = {
	/**
	 * Whether a form submission or session initialization is in progress.
	 */
	loading: Ref<boolean>;

	/**
	 * Current form field values, keyed by form ID then widget ID.
	 */
	forms: Ref<Record<string, Record<string, unknown>>>;

	/**
	 * Current validation and info messages, keyed by form ID then widget ID.
	 */
	messages: Ref<Record<string, Record<string, NativeFlowMessage>>>;

	/**
	 * The current login flow state returned by the backend.
	 */
	state: Ref<Partial<NativeFlowState>>;

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

/**
 * Callbacks and parameters of the native login flow. See `NativeLoginControllerOptions` in `@strivacity/sdk-core`.
 */
export type UseNativeLoginOptions = NativeLoginControllerOptions;

/**
 * Extends the base SDKStorage interface with optional back-channel logout support.
 */
export type NuxtServerStorage = SDKStorage<
	[event?: H3Event],
	[event?: H3Event, cookieOptions?: CookieOptions],
	[event?: H3Event, cookieOptions?: CookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type NuxtServerSDKOptions<Storage extends NuxtServerStorage = NuxtServerStorage, StateStorage extends SDKStorage = SDKStorage> = ServerSDKOptions<
	H3Event,
	Storage,
	StateStorage
>;

export type NuxtServerSDKInitConfig = ServerSDKInitConfig<H3Event> &
	Partial<Omit<NuxtServerSDKOptions, 'storage' | 'stateStorage' | 'logging' | 'httpClient'>> & {
		/**
		 * Optional path to a custom storage factory module.
		 * The factory should export a function that returns an object implementing the SDKStorage interface.
		 */
		storageFactoryPath?: string;

		/**
		 * Optional path to a custom state storage factory module.
		 * The factory should export a function that returns an object implementing the SDKStorage interface.
		 */
		stateStorageFactoryPath?: string;

		/**
		 * Optional path to a custom logging factory module.
		 * The factory should export a function that returns an object implementing the SDKLogging interface.
		 */
		loggingFactoryPath?: string;

		/**
		 * Optional path to a custom HTTP client factory module.
		 * The factory should export a function that returns an object implementing the SDKHttpClient interface.
		 */
		httpClientFactoryPath?: string;
	};

export type NuxtServerSDK<TEvent extends H3Event = H3Event> = BaseServerSDK<TEvent>;
