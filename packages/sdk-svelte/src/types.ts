import type { IdTokenClaims, LoginFlowMessage, LoginFlowState, SDKOptions } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';

/**
 * Represents the session state, including authentication details and token information.
 */
export type State = {
	/**
	 * Indicates if the session is being loaded.
	 */
	loading: boolean;

	/**
	 * The SDK options used to configure the session.
	 */
	options: SDKOptions;

	/**
	 * Indicates whether the user is authenticated.
	 */
	isAuthenticated: boolean;

	/**
	 * Claims from the ID token or `null` if not available.
	 */
	idTokenClaims: IdTokenClaims | null;

	/**
	 * The access token or `null` if not available.
	 */
	accessToken: string | null;

	/**
	 * The refresh token or `null` if not available.
	 */
	refreshToken: string | null;

	/**
	 * Indicates if the access token has expired.
	 */
	accessTokenExpired: boolean;

	/**
	 * Expiration date of the access token or `null` if not set.
	 */
	accessTokenExpirationDate: number | null;
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
	 * Initiates the entry process.
	 */
	entry: InstanceType<typeof PopupFlow>['entry'];

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
	 * Initiates the entry process.
	 */
	entry: InstanceType<typeof RedirectFlow>['entry'];

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
	 * Initiates the entry process.
	 */
	entry: InstanceType<typeof NativeFlow>['entry'];

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
export type PopupContext = PopupSDK & { state: State };

/**
 * Represents a combined context for Redirect-based flows, containing both the Redirect SDK and the session state.
 */
export type RedirectContext = RedirectSDK & { state: State };

/**
 * Represents a combined context for Native-based flows, containing both the Native SDK and the session state.
 */
export type NativeContext = NativeSDK & { state: State };

export type NativeFlowContextValue = {
	loading: boolean;
	forms: Record<string, Record<string, unknown>>;
	messages: Record<string, Record<string, LoginFlowMessage>>;
	state: Partial<LoginFlowState>;
	submitForm: (formId: string) => Promise<void>;
	triggerFallback: (hostedUrl?: string) => void;
	triggerClose: () => void;
	setFormValue: (formId: string, widgetId: string, value: unknown) => void;
	setMessage: (formId: string, widgetId: string, value: LoginFlowMessage) => void;
};
