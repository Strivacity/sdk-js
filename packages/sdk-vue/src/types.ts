import type { Ref } from 'vue';
import type { IdTokenClaims, LoginFlowMessage, LoginFlowState, SDKOptions } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';

/**
 * Represents the session state, including authentication details and token information.
 */
export type Session = {
	/**
	 * Reactive reference to the loading state of the session.
	 * `true` when the session is initializing, otherwise `false`.
	 */
	loading: Ref<boolean>;

	/**
	 * The SDK options used to configure the session.
	 */
	options: Ref<SDKOptions>;

	/**
	 * Reactive reference to the user's authentication status.
	 * `true` if the user is authenticated, otherwise `false`.
	 */
	isAuthenticated: Ref<boolean>;

	/**
	 * Reactive reference to the claims contained in the ID token.
	 * Contains user identity and other information, or `null` if not authenticated.
	 */
	idTokenClaims: Ref<IdTokenClaims | null>;

	/**
	 * Reactive reference to the current access token for API authorization.
	 * `null` if the user is not authenticated or the token is unavailable.
	 */
	accessToken: Ref<string | null>;

	/**
	 * Reactive reference to the refresh token, used to refresh the access token.
	 * `null` if the user is not authenticated or the refresh token is unavailable.
	 */
	refreshToken: Ref<string | null>;

	/**
	 * Reactive reference indicating if the access token has expired.
	 * `true` if expired, otherwise `false`.
	 */
	accessTokenExpired: Ref<boolean>;

	/**
	 * Reactive reference to the expiration date of the access token in Unix time (milliseconds).
	 * `null` if no token is available or the session is not authenticated.
	 */
	accessTokenExpirationDate: Ref<number | null>;
};

/**
 * Represents the available authentication flows and operations for Popup-based interactions.
 */
export type PopupSDK = {
	/**
	 * Represents the SDK instance.
	 */
	sdk: InstanceType<typeof PopupFlow>;

	/**
	 * Initiates the login process.
	 */
	login: InstanceType<typeof PopupFlow>['login'];

	/**
	 * Registers a new user.
	 */
	register: InstanceType<typeof PopupFlow>['register'];

	/**
	 * Refreshes the user's session.
	 */
	refresh: InstanceType<typeof PopupFlow>['refresh'];

	/**
	 * Revokes the current session tokens.
	 */
	revoke: InstanceType<typeof PopupFlow>['revoke'];

	/**
	 * Logs out the user.
	 */
	logout: InstanceType<typeof PopupFlow>['logout'];

	/**
	 * Handles the callback after authentication or token exchange.
	 */
	handleCallback: InstanceType<typeof PopupFlow>['handleCallback'];
};

/**
 * Represents the available authentication flows and operations for Redirect-based interactions.
 */
export type RedirectSDK = {
	/**
	 * Represents the SDK instance.
	 */
	sdk: InstanceType<typeof RedirectFlow>;

	/**
	 * Initiates the login process.
	 */
	login: InstanceType<typeof RedirectFlow>['login'];

	/**
	 * Registers a new user.
	 */
	register: InstanceType<typeof RedirectFlow>['register'];

	/**
	 * Refreshes the user's session.
	 */
	refresh: InstanceType<typeof RedirectFlow>['refresh'];

	/**
	 * Revokes the current session tokens.
	 */
	revoke: InstanceType<typeof RedirectFlow>['revoke'];

	/**
	 * Logs out the user.
	 */
	logout: InstanceType<typeof RedirectFlow>['logout'];

	/**
	 * Handles the callback after authentication or token exchange.
	 */
	handleCallback: InstanceType<typeof RedirectFlow>['handleCallback'];
};

/**
 * Represents the available authentication flows and operations for Native-based interactions.
 */
export type NativeSDK = {
	/**
	 * Represents the SDK instance.
	 */
	sdk: InstanceType<typeof NativeFlow>;

	/**
	 * Initiates the login process.
	 */
	login: InstanceType<typeof NativeFlow>['login'];

	/**
	 * Registers a new user.
	 */
	register: InstanceType<typeof NativeFlow>['register'];

	/**
	 * Refreshes the user's session.
	 */
	refresh: InstanceType<typeof NativeFlow>['refresh'];

	/**
	 * Revokes the current session tokens.
	 */
	revoke: InstanceType<typeof NativeFlow>['revoke'];

	/**
	 * Logs out the user.
	 */
	logout: InstanceType<typeof NativeFlow>['logout'];

	/**
	 * Handles the callback after authentication or token exchange.
	 */
	handleCallback: InstanceType<typeof NativeFlow>['handleCallback'];
};

/**
 * Represents a combined context for Popup-based flows, containing both the Popup SDK and the session state.
 */
export type PopupContext = PopupSDK & Session;

/**
 * Represents a combined context for Redirect-based flows, containing both the Redirect SDK and the session state.
 */
export type RedirectContext = RedirectSDK & Session;

/**
 * Represents a combined context for Redirect-based flows, containing both the Redirect SDK and the session state.
 */
export type NativeContext = NativeSDK & Session;

export type NativeFlowContextValue = {
	loading: Ref<boolean>;
	forms: Ref<Record<string, Record<string, unknown>>>;
	messages: Ref<Record<string, Record<string, LoginFlowMessage>>>;
	state: Ref<Partial<LoginFlowState>>;
	submitForm: (formId: string) => Promise<void>;
	triggerFallback: (hostedUrl?: string) => void;
	setFormValue: (formId: string, widgetId: string, value: unknown) => void;
	setMessage: (formId: string, widgetId: string, value: LoginFlowMessage) => void;
};
