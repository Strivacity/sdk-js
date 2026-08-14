import type { Request as ExpressRequest, Response as ExpressResponse, Router } from 'express';
import type { CookieOptions, LogoutTokenClaims, SDKHttpClient, SDKInitConfig, SDKOptions, SDKStorage, SessionData } from '@strivacity/sdk-core/types';

declare global {
	interface StrivacityFramework {
		stateStore: Map<string, string>;
	}

	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace globalThis {
		// eslint-disable-next-line no-var
		var sty: StrivacityFramework;
	}
}

export * from '@strivacity/sdk-core/types';

export type AngularServerRequest = ExpressRequest | Request;

export type AngularServerStorage = SDKStorage<
	[req?: AngularServerRequest],
	[req?: ExpressRequest, res?: ExpressResponse, cookieOptions?: CookieOptions],
	[req?: ExpressRequest, res?: ExpressResponse, cookieOptions?: CookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type AngularServerSDKOptions<Storage extends AngularServerStorage = AngularServerStorage, StateStorage extends SDKStorage = SDKStorage> = SDKOptions<
	Storage,
	StateStorage
> & {
	/**
	 * Optional URI to redirect to after a successful login if no `returnTo` parameter is provided in the login request.
	 *
	 * @type {string}
	 */
	postLoginRedirectUri: string;

	/** Optional URI to redirect to after a successful logout.
	 *
	 * @type {string}
	 */
	postLogoutRedirectUri: string;

	/**
	 * Max age of the cookie in seconds.
	 *
	 * @type {number}
	 * @default 2592000 (30 days)
	 */
	cookieMaxAge: number;

	/**
	 * Encrypted cookie storage secret. Required for encrypted cookie storage.
	 *
	 * @type {string}
	 */
	secret: string;

	/**
	 * URL prefix for auth routes (login, logout, callback, etc.), relative to where `createServerSDK().router` is mounted.
	 *
	 * @type {string}
	 * @default '/auth'
	 */
	authUrlPrefix: string;
};

export type AngularServerSDKInitConfig<
	Storage extends AngularServerStorage = AngularServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = SDKInitConfig & Partial<AngularServerSDKOptions<Storage, StateStorage>>;

export type AngularServerSDK = {
	/**
	 * The HTTP client used for making requests to the Strivacity API.
	 */
	readonly httpClient: SDKHttpClient;

	/**
	 * The Express router exposing the authentication endpoints.
	 * Mount it under `authUrlPrefix`, e.g. `app.use('/auth', sdk.router)`.
	 */
	readonly router: Router;

	/**
	 * Retrieves the current session data from the encrypted cookie storage.
	 *
	 * @param {AngularServerRequest} [req] - The incoming request to read cookies from.
	 * @returns {Promise<SessionData | null>} The current session, or `null` if there is none.
	 */
	getSession(req?: AngularServerRequest): Promise<SessionData | null>;

	/**
	 * Replaces the current session data with the provided data.
	 */
	updateSession(session: SessionData, req?: ExpressRequest, res?: ExpressResponse): Promise<void>;

	/**
	 * Refreshes the current access token using the stored refresh token and persists the updated session.
	 */
	refreshSession(req?: ExpressRequest, res?: ExpressResponse): Promise<SessionData>;

	/**
	 * Revokes the current tokens and clears the session from storage.
	 */
	revokeSession(req?: ExpressRequest, res?: ExpressResponse): Promise<void>;

	/**
	 * Logs the user out, clears the session, and returns the end-session (logout) URL to redirect to.
	 */
	logout(postLogoutRedirectUri: string | URL, req?: ExpressRequest, res?: ExpressResponse): Promise<URL>;
};
