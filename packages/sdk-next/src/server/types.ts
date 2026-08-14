/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';
import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult, NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { NextRequest, NextResponse } from 'next/server';
import type { SDKOptions, SDKInitConfig, SDKStorage, SessionData, SDKHttpClient, CookieOptions, LogoutTokenClaims } from './types';

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

export type PagesRouterRequest = IncomingMessage | NextApiRequest;
export type PagesRouterResponse = ServerResponse<IncomingMessage> | NextApiResponse;

export type NextServerStorage = SDKStorage<
	[req?: NextRequest | Request | PagesRouterRequest],
	[req?: NextRequest | Request | PagesRouterRequest, res?: NextResponse | PagesRouterResponse, cookieOptions?: CookieOptions],
	[req?: NextRequest | Request | PagesRouterRequest, res?: NextResponse | PagesRouterResponse, cookieOptions?: CookieOptions]
> & {
	deleteByLogoutToken?(token: LogoutTokenClaims): Promise<void>;
};

export type AppRouteHandlerFnContext = {
	params?: Promise<Record<string, string | string[]>>;
};

export type AppRouteHandlerFn = (req: NextRequest | Request, ctx: AppRouteHandlerFnContext) => Promise<Response> | Response;

export type WithApiAuthRequiredAppRoute = (apiRoute: AppRouteHandlerFn) => AppRouteHandlerFn;

export type WithApiAuthRequiredPageRoute = (apiRoute: NextApiHandler) => NextApiHandler;

export type WithApiAuthRequired = WithApiAuthRequiredAppRoute & WithApiAuthRequiredPageRoute;

export type GetServerSidePropsResultWithSession<P = any> = GetServerSidePropsResult<P & { session: SessionData }>;

export type PageRoute<P, Q extends ParsedUrlQuery = ParsedUrlQuery> = (ctx: GetServerSidePropsContext<Q>) => Promise<GetServerSidePropsResultWithSession<P>>;

export type AppRouterPageRouteOpts = {
	params?: Promise<Record<string, string | string[]>>;
	searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
	session?: SessionData;
};

export type AppRouterPageRoute<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts> = (obj: P) => Promise<any> | any;

export type WithAuthGuardPageRouterOptions<P extends { [key: string]: any } = { [key: string]: any }, Q extends ParsedUrlQuery = ParsedUrlQuery> = {
	getServerSideProps?: GetServerSideProps<P, Q>;
	returnTo?: string;
};

export type WithAuthGuardPageRouter = <P extends { [key: string]: any } = { [key: string]: any }, Q extends ParsedUrlQuery = ParsedUrlQuery>(
	opts?: WithAuthGuardPageRouterOptions<P, Q>,
) => PageRoute<P, Q>;

export type WithAuthGuardAppRouterOptions<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts> = {
	/**
	 * The URL to redirect the user to after a successful login.
	 */
	returnTo?: string | ((obj: P) => Promise<string> | string);
};

export type WithAuthGuardAppRouter = <P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts>(
	fn: AppRouterPageRoute<P>,
	opts?: WithAuthGuardAppRouterOptions<P>,
) => AppRouterPageRoute<P>;

export type WithAuthGuard = WithAuthGuardPageRouter & WithAuthGuardAppRouter;

export type NextServerSDKOptions<Storage extends NextServerStorage = NextServerStorage, StateStorage extends SDKStorage = SDKStorage> = SDKOptions<
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

export type NextServerSDKInitConfig<Storage extends NextServerStorage = NextServerStorage, StateStorage extends SDKStorage = SDKStorage> = SDKInitConfig &
	Partial<NextServerSDKOptions<Storage, StateStorage>>;

export type NextServerSDK = {
	/**
	 * The HTTP client used for making requests to the Strivacity API.
	 */
	readonly httpClient: SDKHttpClient;

	/**
	 * Wraps an API route handler with an authentication guard. Returns 401 if the user is not authenticated.
	 *
	 * @param {AppRouteHandlerFn | NextApiHandler} apiRoute - The API route handler to wrap.
	 * @returns The wrapped handler that enforces authentication.
	 */
	withApiAuthRequired: WithApiAuthRequired;

	/**
	 * Wraps a React component with an authentication guard. If the user is not authenticated, they will be redirected to the login page.
	 *
	 * @param {React.ComponentType<any>} Component - The React component to wrap with the authentication guard.
	 * @returns {React.ComponentType<any>} A new React component that includes the authentication guard.
	 */
	withAuthGuard: WithAuthGuard;

	/**
	 * Retrieves the current session data from the encrypted cookie storage.
	 *
	 * App Router (Server Components, Server Actions, Route Handlers): call without arguments.
	 * Pages Router / middleware: pass the request object to read cookies directly.
	 *
	 * @param {NextRequest | Request | PagesRouterRequest} [req] - Optional request object for Pages Router / middleware to read cookies directly.
	 * @returns {Promise<SessionData | null>} A promise that resolves to the session data or null if no session exists.
	 */
	getSession(req?: NextRequest | Request | PagesRouterRequest): Promise<SessionData | null>;

	/**
	 * Updates the session data for the currently authenticated user.
	 *
	 * - App Router (Server Actions, Route Handlers): call with the session object only.
	 * - Middleware: pass `NextRequest` and `NextResponse` so the updated cookie is written to the response.
	 * - Pages Router: pass the Pages Router request and response objects.
	 *
	 * @param {SessionData} session - The updated session data to persist.
	 * @param {NextRequest | Request | PagesRouterRequest} [req] - Optional request object for Pages Router / middleware to read cookies directly.
	 * @param {NextResponse | ServerResponse<IncomingMessage>} [res] - Optional response object for Pages Router / middleware to write the updated cookie.
	 * @returns {Promise<void>} A promise that resolves when the session is successfully updated.
	 * @throws {Error} If the user is not authenticated.
	 */
	updateSession(session: SessionData): Promise<void>;
	updateSession(req: NextRequest, res: NextResponse, session: SessionData): Promise<void>;
	updateSession(req: PagesRouterRequest, res: PagesRouterResponse, session: SessionData): Promise<void>;

	/**
	 * Refreshes the session using the refresh token and persists the new tokens.
	 * Throws if no refresh token is available.
	 *
	 * App Router (Server Actions, Route Handlers): call without arguments.
	 * Middleware: pass `req` and `res` so the updated cookie is written to the response.
	 *
	 * @returns {Promise<SessionData>} A promise that resolves to the refreshed session data.
	 * @throws {Error} If no refresh token is available or if the refresh operation fails.
	 */
	refreshSession(): Promise<SessionData>;
	refreshSession(req: NextRequest, res: NextResponse): Promise<SessionData>;

	/**
	 * Revokes the session tokens and deletes the session cookie.
	 *
	 * App Router (Server Actions, Route Handlers): call without arguments.
	 * Middleware: pass `req` and `res` so the cleared cookie is written to the response.
	 *
	 * @return {Promise<void>} A promise that resolves when the session is successfully revoked and the cookie is cleared.
	 */
	revokeSession(): Promise<void>;
	revokeSession(req: NextRequest, res: NextResponse): Promise<void>;

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
	 * @param {NextRequest} req - Optional NextRequest object for reading cookies directly (used in Pages Router / middleware).
	 * @param {NextResponse} res - Optional NextResponse object for writing the updated cookie (used in Pages Router / middleware).
	 * @returns {Promise<SessionData>} The newly created session data.
	 */
	completeLogin(params: Record<string, string>, req?: NextRequest, res?: NextResponse): Promise<SessionData>;

	/**
	 * Deletes the local session and builds the IdP end-session URL.
	 * Redirects to `postLogoutRedirectUri` directly if no `id_token` is present.
	 *
	 * @param postLogoutRedirectUri - Absolute URL to redirect to after logout.
	 * @returns The URL to redirect the user to.
	 */
	logout(postLogoutRedirectUri: string | URL): Promise<URL>;

	/**
	 * Builds the authorization URL, stores PKCE state in the transaction storage, and redirects to the IDP.
	 * Supports ?returnTo=<relative-path> for post-login redirect.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse that redirects the user to the IDP authorization endpoint.
	 */
	handleLogin: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Proxies the embedded login session initiation request to the IdP.
	 * Calls the authorization endpoint and streams the raw response back to the client.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object. Query parameters are forwarded as login params.
	 * @returns {Promise<NextResponse>} A promise resolving to the proxied IdP response, or a 500 on error.
	 */
	handleLoginSession: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Builds the authorization URL for registration, stores PKCE state in the transaction storage, and redirects to the IDP.
	 * Supports ?returnTo=<relative-path> for post-login redirect.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse that redirects the user to the IDP authorization endpoint.
	 */
	handleRegister: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Exchanges the authorization code, stores the encrypted session cookie, clears the transaction cookie.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse that redirects the user to the post-login redirect URI.
	 */
	handleCallback: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Clears the session cookie and redirects to the IDP end-session endpoint.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse that redirects the user to the IDP end-session endpoint.
	 */
	handleLogout: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Silently refreshes the session using the refresh token. Returns 204 on success.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse that indicates the result of the refresh operation.
	 */
	handleRefresh: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Revokes the session tokens and redirects to the post-logout URI.
	 * Unlike handleLogout, does not redirect to the IDP end-session endpoint.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse that indicates the result of the revoke operation.
	 */
	handleRevoke: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Handles the entry point for the embedded login flow.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse that redirects the user to the appropriate login or registration page based on the request parameters.
	 */
	handleEntry: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Handles a Back-Channel Logout request from the IdP.
	 * Verifies the logout_token JWT, then calls `deleteByLogoutToken` on the configured storage.
	 * Requires `storage` in `NextServerSDKInitConfig` to implement `NextServerStorage`.
	 *
	 * @param {NextRequest} req - The incoming POST request containing the logout_token form field.
	 * @returns {Promise<NextResponse>} 200 on success, 400 on invalid token, 501 if no sessionStore is configured.
	 */
	handleBackChannelLogout: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Handles the incoming Next.js request and routes it to the appropriate handler based on the request path.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse based on the request path and method.
	 */
	handler: (req: NextRequest) => Promise<NextResponse>;
};
