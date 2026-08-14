import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { ParsedUrlQuery } from 'node:querystring';
import type {
	SessionData,
	NextServerSDK,
	NextServerSDKOptions,
	NextServerSDKInitConfig,
	WithAuthGuardAppRouterOptions,
	WithAuthGuardPageRouterOptions,
	AppRouterPageRoute,
	AppRouterPageRouteOpts,
	PageRoute,
	AppRouteHandlerFn,
	AppRouteHandlerFnContext,
	PagesRouterRequest,
	PagesRouterResponse,
	LogoutTokenClaims,
} from './types';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
	getDefaultFlowState,
	getSDKOptions,
	buildEndSessionUrl,
	buildAuthorizationUrl,
	revokeToken,
	refreshToken,
	exchangeCode,
	verifyJwt,
	fetchFlowEntry,
} from '@strivacity/sdk-core/utils/oidc';
import { loadSession, serializeSession } from '@strivacity/sdk-core/utils/session';
import { parseState } from '@strivacity/sdk-core/utils/state';
import { createServerStateStorage, getEncryptedCookieStorage } from './storages';
import { proxyResponse, toSafeRedirect } from './utils';
import { apiAppRouteHandlerFactory, apiPageRouteHandlerFactory } from './handlers/api';
import { appRouteHandlerFactory, pageRouteHandlerFactory } from './handlers/route';

const RETURN_TO_COOKIE = 'sty.returnTo';
const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

export function createServerSDK(opts: NextServerSDKInitConfig): NextServerSDK {
	if (!opts.issuer) {
		throw new Error('Missing Strivacity SDK option: issuer');
	}
	if (!opts.clientId) {
		throw new Error('Missing Strivacity SDK option: clientId');
	}
	if (!opts.redirectUri) {
		throw new Error('Missing Strivacity SDK option: redirectUri');
	}
	if (opts.scopes && !Array.isArray(opts.scopes)) {
		throw new Error('Invalid Strivacity SDK option: scopes');
	}
	if (typeof opts.serverSideSession === 'undefined') {
		opts.serverSideSession = true;
	}
	if (!opts.postLoginRedirectUri) {
		opts.postLoginRedirectUri = new URL(opts.redirectUri).origin;
	}
	if (!opts.postLogoutRedirectUri) {
		opts.postLogoutRedirectUri = new URL(opts.redirectUri).origin;
	}
	if (!opts.cookieMaxAge) {
		opts.cookieMaxAge = 30 * 24 * 60 * 60;
	}
	if (!opts.storage) {
		if (!opts.secret) {
			throw new Error('Secret is required for encrypted cookie storage');
		}

		opts.storage = getEncryptedCookieStorage(opts.secret, { maxAge: opts.cookieMaxAge });
	}
	if (!opts.stateStorage) {
		opts.stateStorage = createServerStateStorage();
	}
	if (!opts.urlHandler) {
		opts.urlHandler = async () => Promise.resolve(undefined);
	}
	if (!opts.authUrlPrefix) {
		opts.authUrlPrefix = '/auth';
	}

	const options = getSDKOptions<NextServerSDKOptions>(getDefaultFlowState(), opts);
	const loginUrl = ['embedded', 'native'].includes(options.mode) ? options.loginUri : `${options.authUrlPrefix}/login`;

	// region helpers

	function getOrigin(req: NextRequest): string {
		return req.nextUrl.origin;
	}

	function getSearchParams(req: NextRequest): URLSearchParams {
		return req.nextUrl.searchParams;
	}

	function getPathname(req: NextRequest): string {
		let { pathname } = req.nextUrl;

		if (req.nextUrl.basePath && pathname.startsWith(req.nextUrl.basePath)) {
			pathname = pathname.slice(req.nextUrl.basePath.length) || '/';
		}

		return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
	}

	// endregion

	// region guards

	function withApiAuthRequired(apiRoute: AppRouteHandlerFn): AppRouteHandlerFn;
	function withApiAuthRequired(apiRoute: NextApiHandler): NextApiHandler;
	function withApiAuthRequired(apiRoute: AppRouteHandlerFn | NextApiHandler): AppRouteHandlerFn | NextApiHandler {
		return (req: NextRequest | Request | NextApiRequest, resOrCtx?: AppRouteHandlerFnContext | NextApiResponse) => {
			if (req instanceof Request) {
				const appRouteHandler = apiAppRouteHandlerFactory(getSession);
				const wrappedAppRoute = appRouteHandler(apiRoute as AppRouteHandlerFn);
				return wrappedAppRoute(req, (resOrCtx ?? {}) as AppRouteHandlerFnContext);
			}

			const pageRouteHandler = apiPageRouteHandlerFactory(getSession);
			const wrappedPageRoute = pageRouteHandler(apiRoute as NextApiHandler);
			return wrappedPageRoute(req, resOrCtx as NextApiResponse);
		};
	}

	function withAuthGuard(): PageRoute<Record<string, unknown>, ParsedUrlQuery>;
	function withAuthGuard<P extends Record<string, unknown> = Record<string, unknown>, Q extends ParsedUrlQuery = ParsedUrlQuery>(
		opts: WithAuthGuardPageRouterOptions<P, Q>,
	): PageRoute<P, Q>;
	function withAuthGuard<P extends AppRouterPageRouteOpts = AppRouterPageRouteOpts>(
		fn: AppRouterPageRoute<P>,
		opts?: WithAuthGuardAppRouterOptions<P>,
	): AppRouterPageRoute<P>;
	function withAuthGuard(
		fnOrOpts?: WithAuthGuardPageRouterOptions | AppRouterPageRoute,
		opts?: WithAuthGuardAppRouterOptions,
	): PageRoute<Record<string, unknown>> | AppRouterPageRoute {
		if (typeof fnOrOpts === 'function') {
			const appRouteHandler = appRouteHandlerFactory({ loginUrl, getSession });
			return appRouteHandler(fnOrOpts, opts);
		}

		const pageRouteHandler = pageRouteHandlerFactory({ loginUrl, getSession });
		return pageRouteHandler(fnOrOpts);
	}

	// endregion

	// region session management

	async function getSession(req?: NextRequest | Request | PagesRouterRequest): Promise<SessionData | null> {
		return loadSession(await options.storage.get(options.storageTokenName, req));
	}

	async function updateSession(session: SessionData): Promise<void>;
	async function updateSession(req: NextRequest, res: NextResponse, session: SessionData): Promise<void>;
	async function updateSession(req: PagesRouterRequest, res: PagesRouterResponse, session: SessionData): Promise<void>;
	async function updateSession(
		reqOrSession: NextRequest | PagesRouterRequest | SessionData,
		res?: NextResponse | PagesRouterResponse,
		sessionData?: SessionData,
	): Promise<void> {
		let session;

		if (!res) {
			// NOTE: App Router: use cookies() from next/headers
			session = reqOrSession as SessionData;
			await options.storage.set(options.storageTokenName, serializeSession(session), undefined, res);
		} else {
			// NOTE: Middleware or Pages Router: write to response
			session = sessionData!;
			await options.storage.set(options.storageTokenName, serializeSession(session), reqOrSession as NextRequest | PagesRouterRequest, res);
		}
	}

	async function refreshSession(): Promise<SessionData>;
	async function refreshSession(req: NextRequest, res: NextResponse): Promise<SessionData>;
	async function refreshSession(req?: NextRequest, res?: NextResponse): Promise<SessionData> {
		options.logging?.debug('Attempting to refresh session');

		const currentSession = await getSession(req);

		if (typeof currentSession?.refresh_token !== 'string') {
			throw new Error('No refresh token available');
		}

		try {
			const newSession = await refreshToken({ refreshToken: currentSession.refresh_token, options });
			await options.storage.set(options.storageTokenName, serializeSession(newSession), req, res);

			options.logging?.debug('Session refresh successful');

			return newSession;
		} catch (error) {
			await options.storage.delete(options.storageTokenName, req, res);
			options.logging?.error('Session refresh failed', error);
			throw error;
		}
	}

	async function revokeSession(): Promise<void>;
	async function revokeSession(req: NextRequest, res: NextResponse): Promise<void>;
	async function revokeSession(req?: NextRequest, res?: NextResponse): Promise<void> {
		const currentSession = await getSession(req);
		const tokenTypeHint = currentSession?.refresh_token ? 'refresh_token' : 'access_token';
		const token = currentSession?.refresh_token ?? currentSession?.access_token ?? null;

		await options.storage.delete(options.storageTokenName, req, res);

		if (!token) {
			options.logging?.debug('Revoke called without session');
			return;
		}

		try {
			await revokeToken({ tokenTypeHint, token, options });
			options.logging?.info(`${tokenTypeHint === 'refresh_token' ? 'Refresh' : 'Access'} token successfully revoked`);
		} catch (error) {
			options.logging?.error('Token revocation failed', error);
			throw error;
		}
	}

	async function getEntrySession(entryUrl: string | URL): Promise<Record<string, string>> {
		const { searchParams: params } = new URL(entryUrl);

		options.logging?.debug('Attempting entry request');

		try {
			const url = new URL('/provider/flow/entry', options.issuer);
			const data = await fetchFlowEntry({
				url,
				params,
				sdkMode: options.mode === 'embedded' ? 'web-embedded' : 'web',
				options,
			});

			options.logging?.debug(`Entry request successful - ${JSON.stringify(data)}`);

			return data;
		} catch (error) {
			options.logging?.error('Entry request failed', error);
			throw error;
		}
	}

	async function completeLogin(params: Record<string, string>, req?: NextRequest, res?: NextResponse): Promise<SessionData> {
		options.logging?.debug('Exchanging authorization code for tokens');

		try {
			const session = await exchangeCode({ params, options });
			await options.storage.set(options.storageTokenName, serializeSession(session), req, res);

			options.logging?.debug('Token exchange successful');

			if (session.access_token && options.logging) {
				options.logging.xEventId = undefined;
				options.logging.info('Login successful');
			}

			return session;
		} catch (error) {
			options.logging?.error('Token exchange failed', error);
			throw error;
		}
	}

	async function logout(postLogoutRedirectUri: string | URL, req?: NextRequest, res?: NextResponse): Promise<URL> {
		options.logging?.debug('Attempting to logout');

		const currentSession = await getSession();
		await options.storage.delete(options.storageTokenName, req, res);

		options.logging?.debug('Logout initiated');

		if (!currentSession?.id_token) {
			options.logging?.debug('Logout called without session');
			return new URL(postLogoutRedirectUri);
		}

		return buildEndSessionUrl({
			url: (await options.getMetadata()).end_session_endpoint,
			idToken: currentSession.id_token,
			postLogoutRedirectUri: new URL(postLogoutRedirectUri).toString(),
		});
	}

	// endregion

	// region handlers

	async function handleLogin(req: NextRequest): Promise<NextResponse> {
		const { returnTo, ...params } = Object.fromEntries(getSearchParams(req));
		const safeReturnTo = toSafeRedirect(returnTo, getOrigin(req));
		const url = await buildAuthorizationUrl({
			params,
			options,
		});
		const startResponse = await options.httpClient.request<string>(url, {
			method: 'GET',
			credentials: 'include',
			redirect: 'manual',
		});

		options.logging?.debug('Attempting to redirect for login');

		if (safeReturnTo) {
			const store = await cookies();

			store.set(RETURN_TO_COOKIE, safeReturnTo, {
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				path: '/',
			});
		}

		return proxyResponse(startResponse);
	}

	async function handleLoginSession(req: NextRequest): Promise<NextResponse> {
		const params = Object.fromEntries(getSearchParams(req));
		const url = await buildAuthorizationUrl({
			params,
			options,
		});

		url.searchParams.append('sdk', 'web-embedded');

		const startResponse = await options.httpClient.request<string>(url, {
			method: 'GET',
			credentials: 'include',
			redirect: 'manual',
		});

		return proxyResponse(startResponse);
	}

	async function handleRegister(req: NextRequest): Promise<NextResponse> {
		const { returnTo, ...params } = Object.fromEntries(getSearchParams(req));
		const safeReturnTo = toSafeRedirect(returnTo, getOrigin(req));
		const url = await buildAuthorizationUrl({
			params: { ...params, prompt: 'create' },
			options,
		});
		const startResponse = await options.httpClient.request<string>(url, {
			method: 'GET',
			credentials: 'include',
			redirect: 'manual',
		});

		options.logging?.debug('Attempting to redirect for login');

		if (safeReturnTo) {
			const store = await cookies();

			store.set(RETURN_TO_COOKIE, safeReturnTo, {
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				path: '/',
			});
		}

		return proxyResponse(startResponse);
	}

	async function handleCallback(req: NextRequest): Promise<NextResponse> {
		const params = Object.fromEntries(getSearchParams(req));

		try {
			const serializedState = await options.stateStorage.get(`sty.${params.state}`);

			await completeLogin(params);

			if (!serializedState) {
				throw new Error('State not found or expired. Please try logging in again.');
			}

			const state = parseState(serializedState);
			const returnTo = req.cookies.get(RETURN_TO_COOKIE)?.value ?? options.postLoginRedirectUri;
			const store = await cookies();
			store.delete(RETURN_TO_COOKIE);

			if (state.metadata?.display === 'popup') {
				// NOTE: If the login was initiated from a popup, we return a HTML page that will close the popup and notify the opener window.
				return new NextResponse(`<!DOCTYPE html><html><body><script>window.opener?.postMessage({}, '*');window.close();</script></body></html>`, {
					headers: { 'content-type': 'text/html; charset=utf-8' },
				});
			}

			return NextResponse.redirect(new URL(returnTo, getOrigin(req)));
		} catch (error) {
			return NextResponse.redirect(
				new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, req.nextUrl.origin),
			);
		}
	}

	async function handleRefresh(req: NextRequest): Promise<NextResponse> {
		const origin = getOrigin(req);
		const returnTo = getSearchParams(req).get('returnTo');
		const safeReturnTo = toSafeRedirect(returnTo, origin);

		try {
			await refreshSession();

			if (safeReturnTo) {
				return NextResponse.redirect(new URL(safeReturnTo, origin));
			}

			return new NextResponse(null, { status: 204 });
		} catch (error) {
			if (error instanceof Error && error.message === 'No refresh token available') {
				const uri = new URL(options.postLoginRedirectUri, origin);

				if (safeReturnTo) {
					uri.searchParams.set('returnTo', safeReturnTo);
				}

				return NextResponse.redirect(uri);
			}

			return NextResponse.redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, getOrigin(req)));
		}
	}

	async function handleRevoke(req: NextRequest): Promise<NextResponse> {
		const origin = getOrigin(req);

		try {
			const redirectResponse = NextResponse.redirect(new URL(options.postLogoutRedirectUri, origin));
			await revokeSession();
			return redirectResponse;
		} catch (error) {
			return NextResponse.redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin));
		}
	}

	async function handleEntry(req: NextRequest): Promise<NextResponse> {
		const origin = getOrigin(req);

		try {
			const data = await getEntrySession(req.nextUrl);
			const uri = new URL(loginUrl, origin);
			uri.searchParams.set('session_id', data.session_id);
			uri.searchParams.set('short_app_id', data.short_app_id);
			uri.searchParams.set('language', data.language);

			return NextResponse.redirect(uri);
		} catch (error) {
			return NextResponse.redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin));
		}
	}

	async function handleLogout(req: NextRequest): Promise<NextResponse> {
		const origin = getOrigin(req);

		try {
			const logoutUrl = await logout(new URL(options.postLogoutRedirectUri, origin));
			return NextResponse.redirect(logoutUrl);
		} catch (error) {
			return NextResponse.redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin));
		}
	}

	async function handleBackChannelLogout(req: NextRequest): Promise<NextResponse> {
		if (typeof options.storage.deleteByLogoutToken !== 'function') {
			return new NextResponse('Back-channel logout requires a storage with deleteByLogoutToken', { status: 501 });
		}

		let logoutToken;

		try {
			const contentType = req.headers.get('content-type') ?? '';

			if (contentType.includes('application/x-www-form-urlencoded')) {
				const body = await req.formData();
				logoutToken = body.get('logout_token') as string | null;
			} else {
				return new NextResponse('Invalid content type: expected application/x-www-form-urlencoded', { status: 400 });
			}
		} catch {
			return new NextResponse('Failed to parse request body', { status: 400 });
		}

		if (!logoutToken) {
			return new NextResponse('Missing logout_token', { status: 400 });
		}

		let claims: LogoutTokenClaims;

		try {
			claims = await verifyJwt<LogoutTokenClaims>(logoutToken, (await options.getMetadata()).jwks_uri);
		} catch (error) {
			return new NextResponse(`Invalid logout_token: ${error instanceof Error ? error.message : 'verification failed'}`, { status: 400 });
		}

		if (claims.nonce !== undefined) {
			return new NextResponse('Invalid logout_token: nonce claim must not be present', { status: 400 });
		}

		if (!claims.events || !(BACKCHANNEL_LOGOUT_EVENT in claims.events)) {
			return new NextResponse(`Invalid logout_token: missing ${BACKCHANNEL_LOGOUT_EVENT} in events`, { status: 400 });
		}

		if (!claims.sid && !claims.sub) {
			return new NextResponse('Invalid logout_token: must contain sid or sub claim', { status: 400 });
		}

		const token: LogoutTokenClaims = {};

		if (claims.sid) {
			token.sid = claims.sid;
		}
		if (claims.sub) {
			token.sub = claims.sub;
		}

		try {
			await options.storage.deleteByLogoutToken(token);
		} catch (error) {
			return new NextResponse(`Failed to delete session: ${error instanceof Error ? error.message : 'unknown error'}`, { status: 500 });
		}

		return new NextResponse(null, { status: 200 });
	}

	async function handler(req: NextRequest): Promise<NextResponse> {
		const pathname = getPathname(req);

		if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/login`) {
			if (['embedded', 'native'].includes(options.mode) && pathname !== loginUrl) {
				const uri = new URL(loginUrl, getOrigin(req));
				getSearchParams(req).forEach((v, k) => uri.searchParams.set(k, v));
				return NextResponse.redirect(uri);
			}

			return handleLogin(req);
		} else if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/login/session`) {
			return handleLoginSession(req);
		} else if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/register`) {
			return handleRegister(req);
		} else if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/callback`) {
			return handleCallback(req);
		} else if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/refresh`) {
			return handleRefresh(req);
		} else if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/revoke`) {
			return handleRevoke(req);
		} else if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/entry`) {
			return handleEntry(req);
		} else if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/logout`) {
			return handleLogout(req);
		} else if (req.method === 'POST' && pathname === `${options.authUrlPrefix}/backchannel-logout`) {
			return handleBackChannelLogout(req);
		}

		return new NextResponse('Not Found', { status: 404 });
	}

	// endregion

	return {
		get httpClient() {
			return options.httpClient;
		},
		withAuthGuard,
		withApiAuthRequired,
		getSession,
		updateSession,
		refreshSession,
		revokeSession,
		getEntrySession,
		completeLogin,
		logout,
		handleLogin,
		handleLoginSession,
		handleRegister,
		handleCallback,
		handleRefresh,
		handleRevoke,
		handleEntry,
		handleLogout,
		handleBackChannelLogout,
		handler,
	};
}
