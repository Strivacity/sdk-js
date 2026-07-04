/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';
import type { ReactNode } from 'react';
import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult, NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { NextRequest, NextResponse } from 'next/server';
import type { SDKOptions, SDKInitConfig, SDKStorage, SessionData, NativeParams, EmbeddedParams, SDKHttpClient } from '../types';
import type * as myaccountAPI from '@strivacity/sdk-core/utils/myaccount';

export type * from '@strivacity/sdk-core';

export type CookieOptions = {
	/**
	 * The maximum age of the cookie in seconds. If not specified, the cookie will be a session cookie.
	 *
	 * @type {number}
	 */
	maxAge?: number;

	/**
	 * The path attribute of the cookie. Defaults to '/'.
	 *
	 * @type {string}
	 * @default '/'
	 */
	path?: string;

	/**
	 * The domain attribute of the cookie. If not specified, the cookie will be valid for the current domain.
	 *
	 * @type {string}
	 */
	domain?: string;

	/**
	 * The SameSite attribute of the cookie. Can be 'strict', 'lax', or 'none'. Defaults to 'lax'.
	 *
	 * @type {'strict' | 'lax' | 'none'}
	 * @default 'lax'
	 */
	sameSite?: 'strict' | 'lax' | 'none';

	/**
	 * Whether the cookie is secure. If true, the cookie will only be sent over HTTPS. Defaults to true.
	 *
	 * @type {boolean}
	 * @default true
	 */
	secure?: boolean;

	/**
	 * Whether the cookie is HTTP-only. If true, the cookie will not be accessible via JavaScript. Defaults to true.
	 *
	 * @type {boolean}
	 * @default true
	 */
	httpOnly?: boolean;
};

export type PagesRouterRequest = IncomingMessage | NextApiRequest;
export type PagesRouterResponse = ServerResponse<IncomingMessage> | NextApiResponse;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type ExtractMyAccountParams<T extends (params: any) => unknown> = Omit<Parameters<T>[0], 'token' | 'options'>;

export type MyAccountFnParams<
	T extends ((params: any) => unknown) | readonly ((params: any) => unknown)[] = (params: { token: string; options: unknown }) => unknown,
> = (T extends readonly ((params: any) => unknown)[]
	? UnionToIntersection<{ [K in keyof T]: ExtractMyAccountParams<Extract<T[K], (params: any) => unknown>> }[number]>
	: T extends (params: any) => unknown
		? ExtractMyAccountParams<T>
		: never) & {
	req?: NextRequest | PagesRouterRequest;
};

export type MyAccountReturnType<T extends (...args: any) => Promise<{ json(): Promise<any> }>> = Awaited<ReturnType<Awaited<ReturnType<T>>['json']>>;

export type LogoutToken = {
	/**
	 * The unique identifier of the session to be logged out.
	 *
	 * @type {string}
	 */
	sid?: string;

	/**
	 * The subject (user) of the session to be logged out.
	 *
	 * @type {string}
	 */
	sub?: string;
};

/**
 * Extends the base SDKStorage interface with additional methods for server-side usage.
 * Adds optional back-channel logout support on top of the base SDKStorage.
 */
export type NextServerStorage = SDKStorage & {
	deleteByLogoutToken(token: LogoutToken): Promise<void>;
};

export type LoginSessionParams = {
	/**
	 * The unique identifier of the login session.
	 *
	 * @type {string}
	 */
	session_id?: string;

	/**
	 * The short application identifier associated with the login session.
	 *
	 * @type {string}
	 */
	short_app_id?: string;

	/**
	 * BCP 47 language tag representing the language preference for the login session.
	 *
	 * @type {string}
	 */
	language?: string;
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
};

export type AppRouterPageRoute<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts> = (obj: P) => Promise<any>;

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

export type NextServerSDKOptions = SDKOptions & {
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
	 * List of routes that require the user to be authenticated.
	 * Unauthenticated requests to these paths are automatically redirected to the login page.
	 *
	 * Used by the `middleware` export.
	 *
	 * @type {Array<string | RegExp>}
	 * @default []
	 */
	protectedRoutes: Array<string | RegExp>;

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
};

export type NextServerSDKInitConfig = SDKInitConfig &
	Partial<NextServerSDKOptions> & {
		storage?: NextServerStorage;
	};

export type NextServerSDK = {
	/** @internal */
	readonly SSR: boolean;

	/**
	 * The HTTP client used for making requests to the Strivacity API.
	 */
	readonly httpClient: SDKHttpClient;

	/**
	 * Server-side helpers for the My Account API.
	 * These call the upstream API directly - no HTTP round-trip through the proxy.
	 */
	readonly myAccount: {
		/**
		 * Fetches the enabled identifiers and linked identities of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object and locale override.
		 * @returns The enabled identifiers and identities of the authenticated user.
		 */
		fetchIdentifiers(params?: MyAccountFnParams<[typeof myaccountAPI.fetchEnabledIdentifiers, typeof myaccountAPI.fetchIdentities]>): Promise<{
			attributes: MyAccountReturnType<typeof myaccountAPI.fetchEnabledIdentifiers>;
			data: MyAccountReturnType<typeof myaccountAPI.fetchIdentities>;
		}>;

		/**
		 * Sends an identifier update challenge request for the authenticated user.
		 * For username updates the identifier is changed immediately.
		 * For email and phone updates a passcode is sent and the passcode length is returned.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.sendIdentifierUpdateChallenge>} params - The type and new value of the identifier to update, and optional locale.
		 * @returns The updated identities or the passcode length.
		 */
		sendIdentifierUpdateChallenge(
			params: MyAccountFnParams<typeof myaccountAPI.sendIdentifierUpdateChallenge>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.sendIdentifierUpdateChallenge>>;

		/**
		 * Updates the identifier of the authenticated user.
		 * Prerequisite: The identifier update challenge must be completed before calling this function.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.updateIdentifier>} params - The type, new value, and challenge passcode.
		 */
		updateIdentifier(params: MyAccountFnParams<typeof myaccountAPI.updateIdentifier>): Promise<MyAccountReturnType<typeof myaccountAPI.updateIdentifier>>;

		/**
		 * Unlinks an external identity from the authenticated user's account.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.unlinkExternalIdentifier>} params - The ID of the external identity to unlink.
		 */
		unlinkExternalIdentifier(
			params: MyAccountFnParams<typeof myaccountAPI.unlinkExternalIdentifier>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.unlinkExternalIdentifier>>;

		/**
		 * Fetches the supported authenticators of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object.
		 * @returns The supported authenticators.
		 */
		fetchSupportedAuthenticators(
			params?: MyAccountFnParams<typeof myaccountAPI.fetchSupportedAuthenticators>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.fetchSupportedAuthenticators>>;

		/**
		 * Fetches the registered authenticators of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object.
		 * @returns The list of authenticators.
		 */
		fetchAuthenticators(
			params?: MyAccountFnParams<typeof myaccountAPI.fetchAuthenticators>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.fetchAuthenticators>>;

		/**
		 * Fetches the soft token authenticator URI for the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object.
		 * @returns The soft token authenticator URI.
		 */
		fetchSoftTokenAuthenticatorURI(params?: MyAccountFnParams): Promise<MyAccountReturnType<typeof myaccountAPI.fetchSoftTokenAuthenticatorURI>>;

		/**
		 * Sends an authenticator creation challenge request.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.sendAuthenticatorCreationChallenge>} params - The target and type of the authenticator challenge.
		 */
		sendAuthenticatorCreationChallenge(
			params: MyAccountFnParams<typeof myaccountAPI.sendAuthenticatorCreationChallenge>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.sendAuthenticatorCreationChallenge>>;

		/**
		 * Sends a passkey creation challenge request.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.sendPasskeyCreationChallenge>} params - The target and type of the passkey challenge.
		 * @returns The WebAuthn credential creation options.
		 */
		sendPasskeyCreationChallenge(
			params: MyAccountFnParams<typeof myaccountAPI.sendPasskeyCreationChallenge>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.sendPasskeyCreationChallenge>>;

		/**
		 * Sends an authenticator deletion challenge request.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.sendAuthenticatorDeletionChallenge>} params - The ID of the authenticator to delete.
		 * @returns The deletion challenge response.
		 */
		sendAuthenticatorDeletionChallenge(
			params: MyAccountFnParams<typeof myaccountAPI.sendAuthenticatorDeletionChallenge>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.sendAuthenticatorDeletionChallenge>>;

		/**
		 * Sends a passkey deletion challenge request.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.sendPasskeyDeletionChallenge>} params - The ID of the passkey to delete.
		 * @returns The deletion challenge response.
		 */
		sendPasskeyDeletionChallenge(
			params: MyAccountFnParams<typeof myaccountAPI.sendPasskeyDeletionChallenge>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.sendPasskeyDeletionChallenge>>;

		/**
		 * Creates an authenticator after the creation challenge has been completed.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.createAuthenticator>} params - Target, type, and challenge passcode.
		 * @returns The created authenticator.
		 */
		createAuthenticator(
			params: MyAccountFnParams<typeof myaccountAPI.createAuthenticator>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.createAuthenticator>>;

		/**
		 * Creates a passkey after the creation challenge has been completed.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.createPasskey>} params - Target, type, and WebAuthn attestation credential data.
		 * @returns The created passkey authenticator.
		 */
		createPasskey(params: MyAccountFnParams<typeof myaccountAPI.createPasskey>): Promise<MyAccountReturnType<typeof myaccountAPI.createPasskey>>;

		/**
		 * Updates the delivery methods of a registered authenticator.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.updateAuthenticatorMethod>} params - The authenticator ID and new methods list.
		 */
		updateAuthenticatorMethod(
			params: MyAccountFnParams<typeof myaccountAPI.updateAuthenticatorMethod>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.updateAuthenticatorMethod>>;

		/**
		 * Deletes an authenticator after the deletion challenge has been completed.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.deleteAuthenticator>} params - The authenticator ID and challenge string.
		 */
		deleteAuthenticator(
			params: MyAccountFnParams<typeof myaccountAPI.deleteAuthenticator>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.deleteAuthenticator>>;

		/**
		 * Deletes a passkey after the deletion challenge has been completed.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.deletePasskey>} params - The passkey ID and WebAuthn assertion credential data.
		 */
		deletePasskey(params: MyAccountFnParams<typeof myaccountAPI.deletePasskey>): Promise<MyAccountReturnType<typeof myaccountAPI.deletePasskey>>;

		/**
		 * Fetches the attributes and personal data of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object and locale override.
		 * @returns The user's attribute definitions and personal data.
		 */
		fetchAccountData(params?: MyAccountFnParams<[typeof myaccountAPI.fetchAttributes, typeof myaccountAPI.fetchAccountData]>): Promise<{
			attributes: MyAccountReturnType<typeof myaccountAPI.fetchAttributes>;
			data: MyAccountReturnType<typeof myaccountAPI.fetchAccountData>;
		}>;

		/**
		 * Updates the personal data of the authenticated user.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.updateAccountData>} params - The updated personal data.
		 * @returns The updated personal data.
		 */
		updateAccountData(params: MyAccountFnParams<typeof myaccountAPI.updateAccountData>): Promise<MyAccountReturnType<typeof myaccountAPI.updateAccountData>>;

		/**
		 * Fetches the account data export of the authenticated user as a binary blob.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.downloadAccountData>} params - The file format (`JSON` or `HTML`) and optional locale.
		 * @returns The exported account data as a binary response.
		 */
		downloadAccountData(
			params: MyAccountFnParams<typeof myaccountAPI.downloadAccountData>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.downloadAccountData>>;

		/**
		 * Deletes the account of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object.
		 */
		deleteAccount(params?: MyAccountFnParams): Promise<MyAccountReturnType<typeof myaccountAPI.deleteAccount>>;

		/**
		 * Fetches the password policy of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object.
		 * @returns The password policy.
		 */
		fetchPasswordPolicy(
			params?: MyAccountFnParams<typeof myaccountAPI.fetchPasswordPolicy>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.fetchPasswordPolicy>>;

		/**
		 * Changes the password of the authenticated user.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.changePassword>} params - The current and new password.
		 */
		changePassword(params: MyAccountFnParams<typeof myaccountAPI.changePassword>): Promise<MyAccountReturnType<typeof myaccountAPI.changePassword>>;

		/**
		 * Fetches the notification preference descriptor and current preferences of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object and locale override.
		 * @returns The preference descriptor list and the current preference values.
		 */
		fetchNotificationPreferences(
			params?: MyAccountFnParams<[typeof myaccountAPI.fetchNotificationPreferenceDescriptor, typeof myaccountAPI.fetchNotificationPreferences]>,
		): Promise<{
			descriptor: MyAccountReturnType<typeof myaccountAPI.fetchNotificationPreferenceDescriptor>;
			preferences: MyAccountReturnType<typeof myaccountAPI.fetchNotificationPreferences>;
		}>;

		/**
		 * Updates the notification preferences of the authenticated user.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.updateNotificationPreferences>} params - The updated notification preferences.
		 * @returns The updated notification preferences.
		 */
		updateNotificationPreferences(
			params: MyAccountFnParams<typeof myaccountAPI.updateNotificationPreferences>,
		): Promise<MyAccountReturnType<typeof myaccountAPI.updateNotificationPreferences>>;

		/**
		 * Fetches the active sessions of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object.
		 * @returns The list of active sessions.
		 */
		fetchSessions(params?: MyAccountFnParams<typeof myaccountAPI.fetchSessions>): Promise<MyAccountReturnType<typeof myaccountAPI.fetchSessions>>;

		/**
		 * Deletes a specific session of the authenticated user.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.deleteSession>} params - The ID of the session to delete.
		 * @returns The list of remaining sessions.
		 */
		deleteSession(params: MyAccountFnParams<typeof myaccountAPI.deleteSession>): Promise<MyAccountReturnType<typeof myaccountAPI.deleteSession>>;

		/**
		 * Fetches the consents of the authenticated user.
		 *
		 * @param {MyAccountFnParams} [params] - Optional request object and locale override.
		 * @returns The list of consents.
		 */
		fetchConsents(params?: MyAccountFnParams<typeof myaccountAPI.fetchConsents>): Promise<MyAccountReturnType<typeof myaccountAPI.fetchConsents>>;

		/**
		 * Opts the authenticated user into a specific consent.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.optInConsent>} params - The ID of the consent to opt-in.
		 * @returns The updated consent.
		 */
		optInConsent(params: MyAccountFnParams<typeof myaccountAPI.optInConsent>): Promise<MyAccountReturnType<typeof myaccountAPI.optInConsent>>;

		/**
		 * Opts the authenticated user out of a specific consent.
		 *
		 * @param {MyAccountFnParams<typeof myaccountAPI.optOutConsent>} params - The consent ID and receipt ID.
		 * @returns The updated consent.
		 */
		optOutConsent(params: MyAccountFnParams<typeof myaccountAPI.optOutConsent>): Promise<MyAccountReturnType<typeof myaccountAPI.optOutConsent>>;
	};

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
	 */
	refreshSession(): Promise<SessionData>;
	refreshSession(req: NextRequest, res: NextResponse): Promise<SessionData>;

	/**
	 * Revokes the session tokens and deletes the session cookie.
	 *
	 * App Router (Server Actions, Route Handlers): call without arguments.
	 * Middleware: pass `req` and `res` so the cleared cookie is written to the response.
	 */
	revokeSession(): Promise<void>;
	revokeSession(req: NextRequest, res: NextResponse): Promise<void>;

	/**
	 * Exchanges an authorization code for tokens and saves the session.
	 * Use this in custom callback logic or embedded/native flows.
	 *
	 * @param params - The callback query parameters (must include `code` and `state`).
	 * @returns The newly created session data.
	 */
	completeLogin(params: Record<string, string>): Promise<SessionData>;

	/**
	 * Deletes the local session and builds the IdP end-session URL.
	 * Redirects to `postLogoutRedirectUri` directly if no `id_token` is present.
	 *
	 * @param postLogoutRedirectUri - Absolute URL to redirect to after logout.
	 * @returns The URL to redirect the user to.
	 */
	logout(postLogoutRedirectUri: string | URL): Promise<URL>;

	/**
	 * Prefetches the login session data for the embedded and native flow.
	 *
	 * In the standard flow, returns `{ sessionId, shortAppId, language }` for use with the embedded widget.
	 * If the IdP returns an authorization code directly (auto-exchange), returns `{ redirectTo }` instead -
	 * the caller must redirect to that URL (e.g. via Next.js `redirect(result.redirectTo)`) so that
	 * the `/auth/callback` Route Handler can exchange the code and set the session cookie.
	 *
	 * @param {NativeParams | EmbeddedParams} loginParams - Optional parameters to customize the login flow.
	 * @returns {Promise<Record<string, string>>} Session init data, or `{ redirectTo }` when a code was returned directly.
	 */
	getLoginSession: (
		loginParams?: NativeParams | EmbeddedParams,
	) => Promise<{ session_id?: string; short_app_id?: string; language?: string; redirectTo?: string }>;

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
	 * Wraps an async page component with login session initialization.
	 * Fetches the embedded/native login session from the IdP, handles automatic redirects,
	 * and passes the resolved session parameters (session_od, short_app_id, language) to the wrapped component.
	 *
	 * @param {function} fn - The page component to wrap. Receives `LoginSessionParams` and returns a ReactNode.
	 * @param {NativeParams | EmbeddedParams} [loginParams] - Optional parameters to customize the login flow.
	 * @returns An async Next.js App Router page component.
	 */
	withLoginSession: (
		fn: (params: LoginSessionParams) => ReactNode | Promise<ReactNode>,
		loginParams?: NativeParams | EmbeddedParams,
	) => () => Promise<ReactNode>;

	/**
	 * Handles the retrieval of the current session data from the encrypted cookie storage and returns it as a NextResponse.
	 *
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse containing the session data or a 401 status if no session exists.
	 */
	handleSession: () => Promise<NextResponse>;

	/**
	 * Builds the authorization URL, stores PKCE state in a transaction cookie, and redirects to the IDP.
	 * Supports ?returnTo=<relative-path> for post-login redirect.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse that redirects the user to the IDP authorization endpoint.
	 */
	handleLogin: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Builds the authorization URL for registration, stores PKCE state in a transaction cookie, and redirects to the IDP.
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
	 * Handles a Back-Channel Logout request from the IdP.
	 * Verifies the logout_token JWT, then calls `deleteByLogoutToken` on the configured storage.
	 * Requires `storage` in `NextServerSDKInitConfig` to implement `NextServerStorage`.
	 *
	 * @param {NextRequest} req - The incoming POST request containing the logout_token form field.
	 * @returns {Promise<NextResponse>} 200 on success, 400 on invalid token, 501 if no sessionStore is configured.
	 */
	handleBackchannelLogout: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Handles the incoming Next.js request and routes it to the appropriate handler based on the request path.
	 *
	 * @param {NextRequest} req - The incoming Next.js request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse based on the request path and method.
	 */
	handler: (req: NextRequest) => Promise<NextResponse>;

	/**
	 * Mounts the SDK auth routes as a Next.js middleware function.
	 * Accepts both a plain `Request` and a `NextRequest`.
	 *
	 * @param {Request | NextRequest} req - The incoming request object.
	 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse based on the request path.
	 */
	middleware: (req: Request | NextRequest) => Promise<NextResponse>;
};
