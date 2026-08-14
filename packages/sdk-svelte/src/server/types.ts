import type { Cookies, Handle, RequestEvent } from '@sveltejs/kit';
import type { SDKOptions, SDKInitConfig, SDKStorage, SessionData, SDKHttpClient, LogoutTokenClaims } from '@strivacity/sdk-core/types';

declare global {
	interface StrivacityFramework {
		stateStore: Map<string, string>;
	}

	var sty: StrivacityFramework;
}

export * from '@strivacity/sdk-core/types';

export type SvelteKitCookieOptions = NonNullable<Parameters<Cookies['set']>[2]>;

export type SvelteKitServerStorage = SDKStorage<
	[event?: RequestEvent],
	[event?: RequestEvent, cookieOptions?: SvelteKitCookieOptions],
	[event?: RequestEvent, cookieOptions?: SvelteKitCookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type SvelteKitServerSDKOptions<
	Storage extends SvelteKitServerStorage = SvelteKitServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = SDKOptions<Storage, StateStorage> & {
	/**
	 * Optional URI to redirect to after a successful login if no `returnTo` parameter is provided in the login request.
	 */
	postLoginRedirectUri: string;

	/**
	 * Optional URI to redirect to after a successful logout.
	 */
	postLogoutRedirectUri: string;

	/**
	 * Max age of the session cookie in seconds.
	 *
	 * @default 2592000 (30 days)
	 */
	cookieMaxAge: number;

	/**
	 * Encrypted cookie storage secret. Required for the default encrypted cookie storage.
	 */
	secret: string;

	/**
	 * URL prefix for auth routes (login, logout, callback, etc.), matched by the `handle` hook.
	 *
	 * @default '/auth'
	 */
	authUrlPrefix: string;
};

export type SvelteKitServerSDKInitConfig<
	Storage extends SvelteKitServerStorage = SvelteKitServerStorage,
	StateStorage extends SDKStorage = SDKStorage,
> = SDKInitConfig & Partial<SvelteKitServerSDKOptions<Storage, StateStorage>>;

export type SvelteKitServerSDK = {
	/**
	 * The HTTP client used for making requests to the Strivacity API.
	 */
	readonly httpClient: SDKHttpClient;

	/**
	 * A SvelteKit `Handle` hook that intercepts and serves the `authUrlPrefix` auth routes (login, register, callback, refresh, revoke, entry, logout, backchannel-logout).
	 * Mount it in `src/hooks.server.ts`, optionally combined with your own hooks via `sequence()`.
	 */
	handle: Handle;

	/**
	 * Retrieves the current session data from the encrypted cookie storage.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<SessionData | null>} A promise that resolves to the current session data, or `null` if no session exists.
	 */
	getSession(event: RequestEvent): Promise<SessionData | null>;

	/**
	 * Updates the session data for the currently authenticated user.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @param {SessionData} session - The new session data to persist.
	 * @returns {Promise<void>} A promise that resolves when the session has been updated.
	 */
	updateSession(event: RequestEvent, session: SessionData): Promise<void>;

	/**
	 * Refreshes the session using the refresh token and persists the new tokens. Throws if no refresh token is available.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<SessionData>} A promise that resolves to the refreshed session data.
	 * @throws {Error} Throws an error if the refresh fails or if there is no refresh token available.
	 */
	refreshSession(event: RequestEvent): Promise<SessionData>;

	/**
	 * Revokes the session tokens and deletes the session cookie.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<void>} A promise that resolves when the session has been revoked and the cookie deleted.
	 * @throws {Error} Throws an error if revocation fails or if there is no session to revoke.
	 */
	revokeSession(event: RequestEvent): Promise<void>;

	/**
	 * Retrieves the entry session data for the login flow.
	 *
	 * @param entryUrl - The URL of the entry point for the login flow.
	 * @returns A promise that resolves to the entry session data.
	 * @throws An error if the entry session cannot be retrieved.
	 */
	getEntrySession(entryUrl: string | URL): Promise<Record<string, string>>;

	/**
	 * Exchanges an authorization code for tokens and persists the resulting session.
	 *
	 * @param params - The query parameters from the callback URL, typically including `code` and `state`.
	 * @param event - The SvelteKit request event.
	 * @returns A promise that resolves to the session data after successful login.
	 */
	completeLogin(params: Record<string, string>, event: RequestEvent): Promise<SessionData>;

	/**
	 * Clears the session cookie and returns the end-session URL to redirect the user to.
	 *
	 * @param postLogoutRedirectUri - Absolute URL to redirect to after logout.
	 * @returns The URL to redirect the user to.
	 */
	logout(postLogoutRedirectUri: string | URL, event: RequestEvent): Promise<URL>;

	/**
	 * Guard for `+page.server.ts`/`+layout.server.ts` `load()` functions: returns the current session, or throws a SvelteKit `redirect()` to the login page if unauthenticated.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @param {Object} [options] - Optional options for the session requirement.
	 * @param {string} [options.returnTo] - Optional relative path to redirect to after login. Defaults to the current page.
	 * @returns {Promise<SessionData>} A promise that resolves to the current session data if authenticated.
	 * @throws {Redirect} Throws a SvelteKit `redirect()` to the login page if unauthenticated.
	 */
	requireSession(event: RequestEvent, options?: { returnTo?: string }): Promise<SessionData>;

	/**
	 * Builds the authorization URL, stores PKCE state in the transaction storage, and redirects to the IDP.
	 * Supports ?returnTo=<relative-path> for post-login redirect.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object that redirects the user to the authorization URL.
	 */
	handleLogin(event: RequestEvent): Promise<Response>;

	/**
	 * Proxies the embedded login session initiation request to the IdP.
	 * Calls the authorization endpoint and streams the raw response back to the client.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object
	 */
	handleLoginSession(event: RequestEvent): Promise<Response>;

	/**
	 * Builds the authorization URL for registration, stores PKCE state in the transaction storage, and redirects to the IDP.
	 * Supports ?returnTo=<relative-path> for post-login redirect.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object
	 */
	handleRegister(event: RequestEvent): Promise<Response>;

	/**
	 * Exchanges the authorization code, stores the encrypted session cookie, clears the transaction cookie.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object
	 */
	handleCallback(event: RequestEvent): Promise<Response>;

	/**
	 * Clears the session cookie and redirects to the IDP end-session endpoint.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object
	 */
	handleRefresh(event: RequestEvent): Promise<Response>;

	/**
	 * Silently refreshes the session using the refresh token. Returns 204 on success.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object
	 */
	handleRevoke(event: RequestEvent): Promise<Response>;

	/**
	 * Revokes the session tokens and redirects to the post-logout URI.
	 * Unlike handleLogout, does not redirect to the IDP end-session endpoint.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object
	 */
	handleEntry(event: RequestEvent): Promise<Response>;

	/**
	 * Handles the entry point for the embedded login flow.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object.
	 */
	handleLogout(event: RequestEvent): Promise<Response>;

	/**
	 * Handles a Back-Channel Logout request from the IdP.
	 * Verifies the logout_token JWT, then calls `deleteByLogoutToken` on the configured storage.
	 * Requires `storage` in `NextServerSDKInitConfig` to implement `NextServerStorage`.
	 *
	 * @param {RequestEvent} event - The SvelteKit request event.
	 * @returns {Promise<Response>} A promise that resolves to a SvelteKit `Response` object.
	 */
	handleBackchannelLogout(event: RequestEvent): Promise<Response>;
};
