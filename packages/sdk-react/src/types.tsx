import type { IdTokenClaims } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';

export type Children = React.ReactElement | React.ReactNode | Array<React.ReactElement | React.ReactNode>;

/**
 * Represents the session state, including authentication details and token information.
 */
export type Session = {
	/**
	 * Indicates if the session is being loaded.
	 */
	loading: boolean;

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
	 * Initiates the login process using a popup window.
	 */
	login: InstanceType<typeof PopupFlow>['login'];

	/**
	 * Registers a new user using a popup flow.
	 */
	register: InstanceType<typeof PopupFlow>['register'];

	/**
	 * Refreshes the user's session using a popup.
	 */
	refresh: InstanceType<typeof PopupFlow>['refresh'];

	/**
	 * Revokes the current session tokens using a popup flow.
	 */
	revoke: InstanceType<typeof PopupFlow>['revoke'];

	/**
	 * Logs out the user using a popup window.
	 */
	logout: InstanceType<typeof PopupFlow>['logout'];

	/**
	 * Handles the callback after a popup-based authentication or token exchange.
	 */
	handleCallback: InstanceType<typeof PopupFlow>['handleCallback'];
};

/**
 * Represents the available authentication flows and operations for Redirect-based interactions.
 */
export type RedirectSDK = {
	/**
	 * Initiates the login process by redirecting the user to the identity provider.
	 */
	login: InstanceType<typeof RedirectFlow>['login'];

	/**
	 * Registers a new user using a redirect flow.
	 */
	register: InstanceType<typeof RedirectFlow>['register'];

	/**
	 * Refreshes the user's session using a redirect flow.
	 */
	refresh: InstanceType<typeof RedirectFlow>['refresh'];

	/**
	 * Revokes the current session tokens using a redirect flow.
	 */
	revoke: InstanceType<typeof RedirectFlow>['revoke'];

	/**
	 * Logs out the user by redirecting to the logout page.
	 */
	logout: InstanceType<typeof RedirectFlow>['logout'];

	/**
	 * Handles the callback after a redirect-based authentication or token exchange.
	 */
	handleCallback: InstanceType<typeof RedirectFlow>['handleCallback'];
};

/**
 * Represents a combined context for Popup-based flows, containing both the Popup SDK and the session state.
 */
export type PopupContext = PopupSDK & Session;

/**
 * Represents a combined context for Redirect-based flows, containing both the Redirect SDK and the session state.
 */
export type RedirectContext = RedirectSDK & Session;
