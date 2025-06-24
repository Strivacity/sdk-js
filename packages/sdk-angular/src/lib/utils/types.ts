import type { IdTokenClaims } from '@strivacity/sdk-core';

/**
 * Represents the current authentication session state.
 */
export type Session = {
	/**
	 * Reactive reference to the loading state of the session.
	 * `true` when the session is initializing, otherwise `false`.
	 */
	loading: boolean;

	/**
	 * Reactive reference to the user's authentication status.
	 * `true` if the user is authenticated, otherwise `false`.
	 */
	isAuthenticated: boolean;

	/**
	 * Reactive reference to the claims contained in the ID token.
	 * Contains user identity and other information, or `null` if not authenticated.
	 */
	idTokenClaims: IdTokenClaims | null;

	/**
	 * Reactive reference to the current access token for API authorization.
	 * `null` if the user is not authenticated or the token is unavailable.
	 */
	accessToken: string | null;

	/**
	 * Reactive reference to the refresh token, used to refresh the access token.
	 * `null` if the user is not authenticated or the refresh token is unavailable.
	 */
	refreshToken: string | null;

	/**
	 * Reactive reference indicating if the access token has expired.
	 * `true` if expired, otherwise `false`.
	 */
	accessTokenExpired: boolean;

	/**
	 * Reactive reference to the expiration date of the access token in Unix time (milliseconds).
	 * `null` if no token is available or the session is not authenticated.
	 */
	accessTokenExpirationDate: number | null;
};
