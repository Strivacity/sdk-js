import type { SDKOptions, SDKInitConfig, SDKStorage, SessionData, SDKHttpClient, CookieOptions, LogoutTokenClaims } from '@strivacity/sdk-core/types';

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

export type RemixServerStorage = SDKStorage<
	[req?: Request],
	[req?: Request, res?: Response, cookieOptions?: CookieOptions],
	[req?: Request, res?: Response, cookieOptions?: CookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type LoaderHandlerFn = (req: Request) => Promise<Response> | Response;

export type WithApiAuthRequired = (handler: LoaderHandlerFn) => LoaderHandlerFn;

export type ServerWithAuthGuardOptions = {
	returnTo?: string | ((req: Request) => Promise<string> | string);
};

export type WithAuthGuard = (
	handler: (args: { req: Request; session: SessionData }) => Promise<Response> | Response,
	opts?: ServerWithAuthGuardOptions,
) => (req: Request) => Promise<Response>;

export type RemixServerSDKOptions<Storage extends RemixServerStorage = RemixServerStorage, StateStorage extends SDKStorage = SDKStorage> = SDKOptions<
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
	 * URL prefix for auth routes (login, logout, callback, etc.).
	 *
	 * @type {string}
	 * @default '/auth'
	 */
	authUrlPrefix: string;
};

export type RemixServerSDKInitConfig<Storage extends RemixServerStorage = RemixServerStorage, StateStorage extends SDKStorage = SDKStorage> = SDKInitConfig &
	Partial<RemixServerSDKOptions<Storage, StateStorage>>;

export type RemixServerSDK = {
	/**
	 * The HTTP client used for making requests to the Strivacity API.
	 */
	readonly httpClient: SDKHttpClient;

	/**
	 * Wraps an API route handler with an authentication guard. Returns 401 if the user is not authenticated.
	 *
	 * @param handler - The API route handler to wrap.
	 * @returns The wrapped handler that enforces authentication.
	 */
	withApiAuthRequired: WithApiAuthRequired;

	/**
	 * Wraps a React component with an authentication guard. If the user is not authenticated, they will be redirected to the login page.
	 *
	 * @param handler - The React component to wrap.
	 * @param opts - Optional configuration for the authentication guard.
	 * @returns The wrapped component that enforces authentication.
	 */
	withAuthGuard: WithAuthGuard;

	/**
	 * Retrieves the current session data from the encrypted cookie storage.
	 *
	 * @param {Request} [req] - The incoming request object containing the session cookie.
	 * @returns {Promise<SessionData | null>} A promise that resolves to the session data or null if no session exists.
	 */
	getSession(req?: Request): Promise<SessionData | null>;

	/**
	 * Updates the session data for the currently authenticated user.
	 *
	 * @param {SessionData} session - The updated session data to persist.
	 * @param {Request} [req] - The incoming request object containing the session cookie.
	 * @param {Response} [res] - The outgoing response object to which the updated session cookie will be attached.
	 * @returns {Promise<void>} A promise that resolves when the session has been updated and the cookie has been set.
	 * @throws {Error} If the user is not authenticated.
	 */
	updateSession(session: SessionData, req?: Request, res?: Response): Promise<void>;

	/**
	 * Refreshes the session using the refresh token and persists the new tokens.
	 * Throws if no refresh token is available.
	 *
	 * @param {Request} [req] - The incoming request object containing the session data in the request body.
	 * @param {Response} [res] - The outgoing response object to which the updated session cookie will be attached.
	 * @returns {Promise<SessionData>} A promise that resolves to the refreshed session data.
	 */
	refreshSession(req?: Request, res?: Response): Promise<SessionData>;

	/**
	 * Revokes the session tokens and deletes the session cookie.
	 *
	 * @param {Request} [req] - The incoming request object containing the session data in the request body.
	 * @param {Response} [res] - The outgoing response object to which the updated session cookie will be attached.
	 * @returns {Promise<void>} A promise that resolves when the session has been revoked and the cookie has been deleted.
	 */
	revokeSession(req?: Request, res?: Response): Promise<void>;

	/**
	 * Retrieves the entry session data for the login flow.
	 *
	 * @param {string | URL} entryUrl - The entry URL containing the query parameters for the login flow.
	 * @returns {Promise<Record<string, string>>} A promise that resolves to the entry session data, which includes the `session_id` and any other relevant parameters for the login login flow.
	 */
	getEntrySession(entryUrl: string | URL): Promise<Record<string, string>>;

	/**
	 * Exchanges an authorization code for tokens and saves the session.
	 * Use this in custom callback logic or embedded/native flows.
	 *
	 * @param {Record<string, string>} params - The callback query parameters (must include `code` and `state`).
	 * @param {Request} [req] - The incoming request object containing the session cookie.
	 * @param {Response} [res] - The outgoing response object to which the updated session cookie will be attached.
	 * @returns {Promise<SessionData>} A promise that resolves to the session data after completing the login process.
	 */
	completeLogin(params: Record<string, string>, req?: Request, res?: Response): Promise<SessionData>;

	/**
	 * Deletes the local session and builds the IdP end-session URL.
	 * Redirects to `postLogoutRedirectUri` directly if no `id_token` is present.
	 *
	 * @param {string | URL} postLogoutRedirectUri - Absolute URL to redirect to after logout.
	 * @param {Request} [req] - The incoming request object containing the session data in the request body.
	 * @param {Response} [res] - The outgoing response object to which the updated session cookie will be attached.
	 * @returns {Promise<URL>} A promise that resolves to the IdP end-session URL or the `postLogoutRedirectUri` if no `id_token` is present.
	 */
	logout(postLogoutRedirectUri?: string | URL, req?: Request, res?: Response): Promise<URL>;

	/**
	 * Builds the authorization URL, stores PKCE state in the transaction storage, and redirects to the IDP.
	 * Supports ?returnTo=<relative-path> for post-login redirect.
	 *
	 * @param {Request} req - The incoming request object.
	 * @returns {Promise<Response>} A promise that resolves to a Response that redirects the user to the IDP authorization endpoint.
	 */
	handleLogin: (req: Request) => Promise<Response>;

	/**
	 * Proxies the embedded login session initiation request to the IdP.
	 * Calls the authorization endpoint and streams the raw response back to the client.
	 *
	 * @param {Request} req - The incoming request object. Query parameters are forwarded as login params.
	 * @returns {Promise<Response>} A promise resolving to the proxied IdP response, or a 500 on error.
	 */
	handleLoginSession: (req: Request) => Promise<Response>;

	/**
	 * Builds the authorization URL for registration, stores PKCE state in the transaction storage, and redirects to the IDP.
	 * Supports ?returnTo=<relative-path> for post-login redirect.
	 *
	 * @param {Request} req - The incoming request object.
	 * @returns {Promise<Response>} A promise that resolves to a Response that redirects the user to the IDP authorization endpoint.
	 */
	handleRegister: (req: Request) => Promise<Response>;

	/**
	 * Exchanges the authorization code, stores the encrypted session cookie, clears the transaction cookie.
	 *
	 * @param {Request} req - The incoming request object.
	 * @returns {Promise<Response>} A promise that resolves to a Response that redirects the user to the post-login redirect URI.
	 */
	handleCallback: (req: Request) => Promise<Response>;

	/**
	 * Clears the session cookie and redirects to the IDP end-session endpoint.
	 *
	 * @param {Request} req - The incoming request object.
	 * @returns {Promise<Response>} A promise that resolves to a Response that redirects the user to the IDP end-session endpoint.
	 */
	handleLogout: (req: Request) => Promise<Response>;

	/**
	 * Silently refreshes the session using the refresh token. Returns 204 on success.
	 *
	 * @param {Request} req - The incoming request object.
	 * @returns {Promise<Response>} A promise that resolves to a Response that indicates the result of the refresh operation.
	 */
	handleRefresh: (req: Request) => Promise<Response>;

	/**
	 * Revokes the session tokens and redirects to the post-logout URI.
	 * Unlike handleLogout, does not redirect to the IDP end-session endpoint.
	 *
	 * @param {Request} req - The incoming request object.
	 * @returns {Promise<Response>} A promise that resolves to a Response that indicates the result of the revoke operation.
	 */
	handleRevoke: (req: Request) => Promise<Response>;

	/**
	 * Handles the entry point for the embedded login flow.
	 *
	 * @param {Request} req - The incoming request object.
	 * @returns {Promise<Response>} A promise that resolves to a Response that redirects the user to the appropriate login or registration page based on the request parameters.
	 */
	handleEntry: (req: Request) => Promise<Response>;

	/**
	 * Handles a Back-Channel Logout request from the IdP.
	 * Verifies the logout_token JWT, then calls `deleteByLogoutToken` on the configured storage.
	 * Requires `storage` in `RemixServerSDKInitConfig` to implement `RemixServerStorage`.
	 *
	 * @param {Request} req - The incoming POST request containing the logout_token form field.
	 * @returns {Promise<Response>} 200 on success, 400 on invalid token, 501 if no sessionStore is configured.
	 */
	handleBackChannelLogout: (req: Request) => Promise<Response>;

	/**
	 * Handles the incoming request and routes it to the appropriate handler based on the request path.
	 *
	 * @param {Request} req - The incoming request object.
	 * @returns {Promise<Response>} A promise that resolves to a Response based on the request path and method.
	 */
	handler: (req: Request) => Promise<Response>;
};
