import type { IdTokenClaims } from '@strivacity/sdk-core';

/**
 * Represents the current authentication session state.
 */
export type Session = {
	/**
	 * Indicates whether the session is in the process of initializing.
	 * When `true`, the session information might not be fully available yet.
	 */
	loading: boolean;

	/**
	 * Indicates whether the user is currently authenticated.
	 * `true` if the user is authenticated, otherwise `false`.
	 */
	isAuthenticated: boolean;

	/**
	 * The claims contained in the ID token if the user is authenticated.
	 * This includes information such as the user's identity and authentication context.
	 * If the user is not authenticated, this will be `null`.
	 */
	idTokenClaims: IdTokenClaims | null;

	/**
	 * The current access token used for authorizing API requests.
	 * This token is `null` if the user is not authenticated or if the token has not been set.
	 */
	accessToken: string | null;

	/**
	 * The current refresh token used to obtain a new access token when the current one expires.
	 * This token is `null` if the user is not authenticated or if the token has not been set.
	 */
	refreshToken: string | null;

	/**
	 * Indicates whether the current access token has expired.
	 * `true` if the token is expired, otherwise `false`.
	 */
	accessTokenExpired: boolean;

	/**
	 * The expiration date of the current access token in Unix time (milliseconds since epoch).
	 * If the access token is not available or the session is not authenticated, this will be `null`.
	 */
	accessTokenExpirationDate: number | null;
};
