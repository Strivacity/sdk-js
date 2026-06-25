import type { CookieOptions, SDKStorage } from './common';
import type { SDKOptions, SDKInitConfig, SessionData, LogoutTokenClaims } from './oidc';

export type ServerCookieOptions = CookieOptions & {
	/**
	 * The expiration date of the cookie. If not provided, the cookie will be a session cookie and will be deleted when the browser is closed.
	 */
	expires?: Date;

	/**
	 * Whether the cookie is HTTP-only. If true, the cookie will not be accessible via JavaScript. Defaults to true.
	 *
	 * @default true
	 */
	httpOnly?: boolean;
};

export type SessionIdCookieStorageOptions = {
	/**
	 * Default cookie options for the session ID cookie.
	 */
	defaultCookieOptions?: Partial<ServerCookieOptions>;

	/**
	 * Function to generate a new UUID for the session ID.
	 *
	 * @default () => crypto.randomUUID()
	 */
	uuidGenerator?: () => string;
};

export type EncryptedCookieStorageOptions = {
	/**
	 * Default cookie options for the encrypted cookie.
	 */
	defaultCookieOptions?: Partial<ServerCookieOptions>;
};

export type ServerAdapter<TEvent = unknown> = {
	/**
	 * Converts the framework-native event into a standard Web `Request`.
	 * Cookie reading/writing is handled entirely by the shared core on top of the `Request`'s `cookie` header and the `Response`'s `set-cookie` header - no framework-specific cookie API is needed here.
	 *
	 * @param {TEvent} event - The framework-native request event.
	 * @returns {Request | Promise<Request>} The equivalent Web `Request` object.
	 */
	toRequest(event: TEvent): Request | Promise<Request>;

	/**
	 * Optional override for building a redirect `Response`. Implement this when the framework needs its own redirect
	 * construction (e.g. throwing a framework-specific redirect object instead of returning a `Response`.
	 * When omitted, the shared core falls back to a plain `Response` with a `Location` header.
	 *
	 * @param {string | URL} url - The absolute URL to redirect to.
	 * @param {number} status - The HTTP status code for the redirect.
	 * @param {TEvent} event - The framework-native request event.
	 * @returns {Response | Promise<Response>} The redirect `Response`.
	 */
	redirect?(url: string | URL, status: number, event?: TEvent): Response | Promise<Response>;

	/**
	 * Optional method to retrieve the session ID from the incoming request.
	 *
	 * @param {string} key - The key identifying the session cookie.
	 * @param {TEvent} [event] - The framework-native request event.
	 * @returns {string | null | Promise<string | null>} The session ID, or `null` if not found.
	 */
	getSessionId?: (key: string, event?: TEvent) => string | null | undefined | Promise<string | null | undefined>;
};

export type ServerStorage<TEvent = unknown> = SDKStorage<[event?: TEvent], [event?: TEvent], [event?: TEvent]> & {
	/**
	 * Optional hook allowing back-channel logout to delete a session by its logout token claims (`sid`/`sub`) instead of by storage key.
	 *
	 * @param {LogoutTokenClaims} token - The subset of logout token claims (`sid`/`sub`) identifying the session(s) to delete.
	 */
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type ServerSDKOptions<
	TEvent = unknown,
	Storage extends ServerStorage<TEvent> = ServerStorage<TEvent>,
	StateStorage extends SDKStorage = SDKStorage,
> = SDKOptions<Storage, StateStorage> & {
	/**
	 * The URI to which the user will be redirected for login.
	 *
	 * @default '/login'
	 */
	loginUri: string;

	/**
	 * URI to redirect to after a successful login if no `returnTo` parameter is provided in the login request.
	 */
	postLoginRedirectUri: string;

	/**
	 * URI to redirect to after a successful logout.
	 */
	postLogoutRedirectUri: string;

	/**
	 * Max age of the session cookie in seconds.
	 *
	 * @default 2592000 (30 days)
	 */
	cookieMaxAge: number;

	/**
	 * Encrypted cookie storage secret. Required when no custom `storage` is provided.
	 */
	secret?: string;

	/**
	 * URL prefix for auth routes (login, logout, callback, etc.) matched by `dispatch`.
	 *
	 * @default '/auth'
	 */
	authUrlPrefix: string;
};

export type ServerSDKInitConfig<
	TEvent = unknown,
	Storage extends ServerStorage<TEvent> = ServerStorage<TEvent>,
	StateStorage extends SDKStorage = SDKStorage,
> = SDKInitConfig & Partial<ServerSDKOptions<TEvent, Storage, StateStorage>>;

export type BaseServerSDK<TEvent = unknown> = {
	options: ServerSDKOptions<TEvent>;

	/**
	 * Retrieves the current session data from storage.
	 *
	 * @param {TEvent} [event] - The framework-native request event.
	 * @returns {Promise<SessionData | null>} A promise that resolves to the current session data, or `null` if no session exists.
	 */
	getSession(event?: TEvent): Promise<SessionData | null>;

	/**
	 * Updates the session data for the currently authenticated user.
	 *
	 * @param {TEvent} [event] - The framework-native request event.
	 * @param {SessionData} session - The new session data to persist.
	 * @returns {Promise<void>} A promise that resolves when the session has been updated.
	 */
	updateSession(session: SessionData, event?: TEvent): Promise<void>;

	/**
	 * Refreshes the session using the refresh token and persists the new tokens. Throws if no refresh token is available.
	 *
	 * @param {TEvent} [event] - The framework-native request event.
	 * @returns {Promise<SessionData>} A promise that resolves to the refreshed session data.
	 * @throws {Error} Throws an error if the refresh fails or if there is no refresh token available.
	 */
	refreshSession(event?: TEvent): Promise<SessionData>;

	/**
	 * Revokes the session tokens and deletes the session from storage.
	 *
	 * @param {TEvent} [event] - The framework-native request event.
	 * @returns {Promise<void>} A promise that resolves when the session has been revoked.
	 * @throws {Error} Throws an error if revocation fails or if there is no session to revoke.
	 */
	revokeSession(event?: TEvent): Promise<void>;

	/**
	 * Retrieves the entry session data for the login flow.
	 *
	 * @param {string | URL} entryUrl - The URL of the entry point for the login flow.
	 * @returns {Promise<Record<string, string>>} A promise that resolves to the entry session data.
	 * @throws {Error} An error if the entry session cannot be retrieved.
	 */
	getEntrySession(entryUrl: string | URL): Promise<Record<string, string>>;

	/**
	 * Exchanges an authorization code for tokens and persists the resulting session.
	 *
	 * @param {Record<string, string>} [params] - The query parameters from the callback URL, typically including `code` and `state`.
	 * @param {TEvent} event - The framework-native request event.
	 * @returns {Promise<SessionData>} A promise that resolves to the session data after successful login.
	 */
	completeLogin(params: Record<string, string>, event?: TEvent): Promise<SessionData>;

	/**
	 * Clears the session and returns the end-session URL to redirect the user to.
	 *
	 * @param {string | URL} postLogoutRedirectUri - Absolute URL to redirect to after logout.
	 * @param {TEvent} [event] - The framework-native request event.
	 * @returns {Promise<URL>} The URL to redirect the user to.
	 */
	logout(postLogoutRedirectUri: string | URL, event?: TEvent): Promise<URL>;

	/**
	 * Builds the authorization URL, stores PKCE state, and proxies the redirect to the IDP. Supports `?returnTo=<relative-path>`.
	 */
	handleLogin(event: TEvent): Promise<Response>;

	/**
	 * Builds the authorization URL for registration (`prompt=create`), stores PKCE state, and proxies the redirect to the IDP.
	 */
	handleRegister(event: TEvent): Promise<Response>;

	/**
	 * Exchanges the authorization code, persists the session, clears the transaction cookie, and redirects back to the caller.
	 */
	handleCallback(event: TEvent): Promise<Response>;

	/**
	 * Refreshes the session using the refresh token. Redirects if `?returnTo=` is present, otherwise responds `204`.
	 */
	handleRefresh(event: TEvent): Promise<Response>;

	/**
	 * Revokes the session tokens and redirects to the post-logout URI (does not redirect to the IDP end-session endpoint).
	 */
	handleRevoke(event: TEvent): Promise<Response>;

	/**
	 * Fetches the entry session and redirects to the login page with the returned `session_id`/`short_app_id`/`language`.
	 */
	handleEntry(event: TEvent): Promise<Response>;

	/**
	 * Clears the session and redirects to the IDP end-session endpoint.
	 */
	handleLogout(event: TEvent): Promise<Response>;

	/**
	 * Verifies an OIDC back-channel logout token and deletes the matching session(s) via `storage.deleteByLogoutToken`.
	 */
	handleBackChannelLogout(event: TEvent): Promise<Response>;

	/**
	 * Dispatches an incoming request to the matching auth route handler based on `authUrlPrefix`, or returns `null` if
	 * the request doesn't match any auth route (caller should continue its own routing/`resolve`/`next()`).
	 *
	 * @param {TEvent} event - The framework-native request event.
	 * @returns {Promise<Response | null>} The handler's response, or `null` if no auth route matched.
	 */
	handler(event: TEvent): Promise<Response | null>;
};
