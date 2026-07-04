import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { ParsedUrlQuery } from 'node:querystring';
import type { ReactNode } from 'react';
import type {
	SessionData,
	NativeParams,
	EmbeddedParams,
	NextServerSDK,
	NextServerSDKOptions,
	NextServerSDKInitConfig,
	LoginSessionParams,
	WithAuthGuardAppRouterOptions,
	WithAuthGuardPageRouterOptions,
	AppRouterPageRoute,
	AppRouterPageRouteOpts,
	PageRoute,
	AppRouteHandlerFn,
	AppRouteHandlerFnContext,
	WithApiAuthRequiredPageRoute,
	PagesRouterRequest,
	PagesRouterResponse,
	NextServerStorage,
	LogoutTokenClaims,
	LogoutToken,
	MyAccountFnParams,
} from '../types';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
	getDefaultFlowState,
	getSDKOptions,
	buildAuthorizationUrl,
	buildEndSessionUrl,
	startLoginSession,
	revokeToken,
	refreshToken,
	exchangeCode,
	verifyJwt,
} from '@strivacity/sdk-core/utils/oidc';
import { isSessionExpired, loadSession, serializeSession } from '@strivacity/sdk-core/utils/session';
import * as myAccountAPI from '@strivacity/sdk-core/utils/myaccount';
import {
	createNextServerStateStorage,
	createNextServerEncryptedCookieStorage,
	getEncryptedSessionFromRequest,
	setEncryptedSessionToResponse,
} from './storages';
import { collectFromNextUrl, toNextRequest } from './utils';
import { apiAppRouteHandlerFactory, apiPageRouteHandlerFactory } from './handlers/api';
import { appRouteHandlerFactory, pageRouteHandlerFactory } from './handlers/route';

const RETURN_TO_COOKIE = 'sty.returnTo';
const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

export function createServerSDK(opts: NextServerSDKInitConfig): NextServerSDK {
	if (!opts.postLoginRedirectUri) {
		opts.postLoginRedirectUri = new URL(opts.redirectUri).origin;
	}
	if (!opts.postLogoutRedirectUri) {
		opts.postLogoutRedirectUri = new URL(opts.redirectUri).origin;
	}
	if (!opts.protectedRoutes) {
		opts.protectedRoutes = [];
	}
	if (!opts.cookieMaxAge) {
		opts.cookieMaxAge = 30 * 24 * 60 * 60;
	}
	if (!opts.storage) {
		if (!opts.secret) {
			throw new Error('Secret is required for encrypted cookie storage');
		}

		opts.storage = createNextServerEncryptedCookieStorage(opts.secret, { maxAge: opts.cookieMaxAge }) as unknown as NextServerStorage;
	}
	if (!opts.stateStorage) {
		opts.stateStorage = createNextServerStateStorage();
	}
	if (!opts.urlHandler) {
		opts.urlHandler = async () => Promise.resolve(undefined);
	}

	const options = getSDKOptions<NextServerSDKInitConfig, NextServerSDKOptions>(getDefaultFlowState(), opts);

	// region myaccount

	async function withMyAccountContext<T>(
		req: NextRequest | PagesRouterRequest | undefined,
		fn: (token: string) => Promise<{ ok: boolean; status: number; statusText: string; json(): Promise<T> }>,
	): Promise<T> {
		const session = await getSession(req);

		if (!session?.access_token) {
			throw new Error('Not authenticated');
		}

		const res = await fn(session.access_token);

		if (!res.ok) {
			throw new Error(`My Account API error: ${res.status} ${res.statusText}`);
		}

		return res.json();
	}

	const myAccount = {
		async fetchIdentifiers({ req }: MyAccountFnParams<[typeof myAccountAPI.fetchEnabledIdentifiers, typeof myAccountAPI.fetchIdentities]> = {}) {
			const language = collectFromNextUrl(req)?.i18n?.locales?.[0];
			const [attributes, data] = await Promise.all([
				withMyAccountContext(req, (token) => myAccountAPI.fetchEnabledIdentifiers({ token, language, options })),
				withMyAccountContext(req, (token) => myAccountAPI.fetchIdentities({ token, options })),
			]);

			return { attributes, data };
		},
		async sendIdentifierUpdateChallenge({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.sendIdentifierUpdateChallenge>) {
			return withMyAccountContext(req, (token) => myAccountAPI.sendIdentifierUpdateChallenge({ ...params, token, options }));
		},
		async updateIdentifier({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.updateIdentifier>) {
			return withMyAccountContext(req, (token) => myAccountAPI.updateIdentifier({ ...params, token, options }));
		},
		async unlinkExternalIdentifier({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.unlinkExternalIdentifier>) {
			return withMyAccountContext(req, (token) => myAccountAPI.unlinkExternalIdentifier({ ...params, token, options }));
		},
		async fetchSupportedAuthenticators({ req }: MyAccountFnParams<typeof myAccountAPI.fetchSupportedAuthenticators> = {}) {
			return withMyAccountContext(req, (token) => myAccountAPI.fetchSupportedAuthenticators({ token, options }));
		},
		async fetchAuthenticators({ req }: MyAccountFnParams<typeof myAccountAPI.fetchAuthenticators> = {}) {
			return withMyAccountContext(req, (token) => myAccountAPI.fetchAuthenticators({ token, options }));
		},
		async fetchSoftTokenAuthenticatorURI({ req }: MyAccountFnParams = {}) {
			return withMyAccountContext(req, (token) => myAccountAPI.fetchSoftTokenAuthenticatorURI({ token, options }));
		},
		async sendAuthenticatorCreationChallenge({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.sendAuthenticatorCreationChallenge>) {
			return withMyAccountContext(req, (token) => myAccountAPI.sendAuthenticatorCreationChallenge({ ...params, token, options }));
		},
		async sendPasskeyCreationChallenge({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.sendPasskeyCreationChallenge>) {
			return withMyAccountContext(req, (token) => myAccountAPI.sendPasskeyCreationChallenge({ ...params, token, options }));
		},
		async sendAuthenticatorDeletionChallenge({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.sendAuthenticatorDeletionChallenge>) {
			return withMyAccountContext(req, (token) => myAccountAPI.sendAuthenticatorDeletionChallenge({ ...params, token, options }));
		},
		async sendPasskeyDeletionChallenge({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.sendPasskeyDeletionChallenge>) {
			return withMyAccountContext(req, (token) => myAccountAPI.sendPasskeyDeletionChallenge({ ...params, token, options }));
		},
		async createAuthenticator({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.createAuthenticator>) {
			return withMyAccountContext(req, (token) => myAccountAPI.createAuthenticator({ ...params, token, options }));
		},
		async createPasskey({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.createPasskey>) {
			return withMyAccountContext(req, (token) => myAccountAPI.createPasskey({ ...params, token, options }));
		},
		async updateAuthenticatorMethod({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.updateAuthenticatorMethod>) {
			return withMyAccountContext(req, (token) => myAccountAPI.updateAuthenticatorMethod({ ...params, token, options }));
		},
		async deleteAuthenticator({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.deleteAuthenticator>) {
			return withMyAccountContext(req, (token) => myAccountAPI.deleteAuthenticator({ ...params, token, options }));
		},
		async deletePasskey({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.deletePasskey>) {
			return withMyAccountContext(req, (token) => myAccountAPI.deletePasskey({ ...params, token, options }));
		},
		async fetchAccountData({ req }: MyAccountFnParams<[typeof myAccountAPI.fetchAttributes, typeof myAccountAPI.fetchAccountData]> = {}) {
			const language = collectFromNextUrl(req)?.i18n?.locales?.[0];
			const [attributes, data] = await Promise.all([
				withMyAccountContext(req, (token) => myAccountAPI.fetchAttributes({ token, language, options })),
				withMyAccountContext(req, (token) => myAccountAPI.fetchAccountData({ token, options })),
			]);

			return { attributes, data };
		},
		async updateAccountData({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.updateAccountData>) {
			return withMyAccountContext(req, (token) => myAccountAPI.updateAccountData({ ...params, token, options }));
		},
		async downloadAccountData({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.downloadAccountData>) {
			return withMyAccountContext(req, (token) => myAccountAPI.downloadAccountData({ ...params, token, options }));
		},
		async deleteAccount({ req }: MyAccountFnParams = {}) {
			return withMyAccountContext(req, (token) => myAccountAPI.deleteAccount({ token, options }));
		},
		async fetchPasswordPolicy({ req }: MyAccountFnParams<typeof myAccountAPI.fetchPasswordPolicy> = {}) {
			return withMyAccountContext(req, (token) => myAccountAPI.fetchPasswordPolicy({ token, options }));
		},
		async changePassword({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.changePassword>) {
			return withMyAccountContext(req, (token) => myAccountAPI.changePassword({ ...params, token, options }));
		},
		async fetchNotificationPreferences({
			req,
		}: MyAccountFnParams<[typeof myAccountAPI.fetchNotificationPreferenceDescriptor, typeof myAccountAPI.fetchNotificationPreferences]> = {}) {
			const language = collectFromNextUrl(req)?.i18n?.locales?.[0];
			const [descriptor, preferences] = await Promise.all([
				withMyAccountContext(req, (token) => myAccountAPI.fetchNotificationPreferenceDescriptor({ token, language, options })),
				withMyAccountContext(req, (token) => myAccountAPI.fetchNotificationPreferences({ token, options })),
			]);

			return { descriptor, preferences };
		},
		async updateNotificationPreferences({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.updateNotificationPreferences>) {
			return withMyAccountContext(req, (token) => myAccountAPI.updateNotificationPreferences({ ...params, token, options }));
		},
		async fetchSessions({ req }: MyAccountFnParams<typeof myAccountAPI.fetchSessions> = {}) {
			return withMyAccountContext(req, (token) => myAccountAPI.fetchSessions({ token, options }));
		},
		async deleteSession({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.deleteSession>) {
			return withMyAccountContext(req, (token) => myAccountAPI.deleteSession({ ...params, token, options }));
		},
		async fetchConsents({ req }: MyAccountFnParams<typeof myAccountAPI.fetchConsents> = {}) {
			return withMyAccountContext(req, (token) => myAccountAPI.fetchConsents({ token, options }));
		},
		async optInConsent({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.optInConsent>) {
			return withMyAccountContext(req, (token) => myAccountAPI.optInConsent({ ...params, token, options }));
		},
		async optOutConsent({ req, ...params }: MyAccountFnParams<typeof myAccountAPI.optOutConsent>) {
			return withMyAccountContext(req, (token) => myAccountAPI.optOutConsent({ ...params, token, options }));
		},
	};

	// endregion

	// region session management

	async function getSession(req?: NextRequest | Request | PagesRouterRequest): Promise<SessionData | null> {
		if (req) {
			const raw = await getEncryptedSessionFromRequest(req, options.storageTokenName, options.secret);

			return loadSession(raw);
		}

		return loadSession(await options.storage.get(options.storageTokenName));
	}

	function updateSession(session: SessionData): Promise<void>;
	function updateSession(req: NextRequest, res: NextResponse, session: SessionData): Promise<void>;
	function updateSession(req: PagesRouterRequest, res: PagesRouterResponse, session: SessionData): Promise<void>;
	async function updateSession(
		reqOrSession: NextRequest | PagesRouterRequest | SessionData,
		res?: NextResponse | PagesRouterResponse,
		sessionData?: SessionData,
	): Promise<void> {
		if (!res) {
			// NOTE: App Router: use cookies() from next/headers
			const session = reqOrSession as SessionData;
			await options.storage.set(options.storageTokenName, serializeSession(session));
		} else {
			// NOTE: Middleware or Pages Router: write to response
			const session = sessionData!;
			await setEncryptedSessionToResponse(res, options.storageTokenName, serializeSession(session), options.secret, { maxAge: options.cookieMaxAge });
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

		let newSession: SessionData;

		try {
			newSession = await refreshToken({ refreshToken: currentSession.refresh_token, options });

			if (res) {
				await setEncryptedSessionToResponse(res, options.storageTokenName, serializeSession(newSession), options.secret, { maxAge: options.cookieMaxAge });
			} else {
				await options.storage.set(options.storageTokenName, serializeSession(newSession));
			}

			options.logging?.debug('Session refresh successful');

			return newSession;
		} catch (error) {
			await options.storage.delete(options.storageTokenName);
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

		await options.storage.delete(options.storageTokenName);

		if (res) {
			await setEncryptedSessionToResponse(res, options.storageTokenName, serializeSession({}), options.secret, { maxAge: 0 });
		}

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

	async function getLoginSession(
		loginParams: NativeParams | EmbeddedParams = {},
	): Promise<{ session_id?: string; short_app_id?: string; language?: string; redirectTo?: string }> {
		const state = getDefaultFlowState();

		if (options.logging) {
			options.logging.xEventId = undefined;
			options.logging.info('Starting login flow session');
		}

		try {
			const params = await startLoginSession({
				language: loginParams.language ?? state.language,
				sdkMode: 'web-embedded',
				loginParams,
				options,
			});

			if (params.code) {
				options.logging?.debug('Received authorization code - redirecting to callback');

				const callbackUrl = new URL('/auth/callback', options.redirectUri);

				for (const [key, value] of Object.entries(params)) {
					callbackUrl.searchParams.set(key, value);
				}

				// NOTE: Cookies cannot be written here because getLoginSession may be called from a Server Component.
				// Instead we return a redirectTo URL pointing to /auth/callback, which runs as a Route Handler
				// where cookies() is available. The caller must perform the redirect (e.g. via Next.js redirect()).
				return { redirectTo: callbackUrl.toString() };
			} else if (params.session_id) {
				if (!params.short_app_id) {
					throw new Error('short_app_id is missing in the response');
				}

				state.sessionId = params.session_id;
				state.shortAppId = params.short_app_id ?? null;

				if (params.language) {
					state.language = params.language;
				}
			} else {
				throw new Error('Neither "code" nor "session_id" is present in the response');
			}
		} catch (error) {
			options.logging?.error('Start login session error', error);
			throw error;
		}

		const result: Record<string, string> = {};

		if (state.sessionId) {
			result.session_id = state.sessionId;
		}
		if (state.shortAppId) {
			result.short_app_id = state.shortAppId;
		}
		if (state.language) {
			result.language = state.language;
		}

		return result;
	}

	function withLoginSession(
		fn: (params: LoginSessionParams) => ReactNode | Promise<ReactNode>,
		loginParams?: NativeParams | EmbeddedParams,
	): () => Promise<ReactNode> {
		return async () => {
			const { redirect } = await import('next/navigation');
			const params = await getLoginSession(loginParams);

			if (params.redirectTo) {
				redirect(params.redirectTo);
			}

			const sessionParams: LoginSessionParams = {
				session_id: params.session_id,
				short_app_id: params.short_app_id,
				language: params.language,
			};

			return fn(sessionParams);
		};
	}

	async function completeLogin(params: Record<string, string>): Promise<SessionData> {
		options.logging?.debug('Exchanging authorization code for tokens');

		try {
			const session = await exchangeCode({ params, options });
			await options.storage.set(options.storageTokenName, serializeSession(session));

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

	async function logout(postLogoutRedirectUri: string | URL): Promise<URL> {
		options.logging?.debug('Attempting to logout');

		const currentSession = await getSession();
		await options.storage.delete(options.storageTokenName);

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

	// region guards

	function isProtectedRoute(pathname: string): boolean {
		return options.protectedRoutes.some((route) => (typeof route === 'string' ? pathname.startsWith(route) : route.test(pathname)));
	}

	function withApiAuthRequired(apiRoute: AppRouteHandlerFn): AppRouteHandlerFn;
	function withApiAuthRequired(apiRoute: NextApiHandler): NextApiHandler;
	function withApiAuthRequired(apiRoute: AppRouteHandlerFn | NextApiHandler): AppRouteHandlerFn | NextApiHandler {
		const appRouteHandler = apiAppRouteHandlerFactory(getSession);
		const pageRouteHandler = apiPageRouteHandlerFactory(getSession);

		const wrappedAppRoute = appRouteHandler(apiRoute as AppRouteHandlerFn);
		const wrappedPageRoute = (pageRouteHandler as WithApiAuthRequiredPageRoute)(apiRoute as NextApiHandler);

		return ((req: NextRequest | Request | NextApiRequest, resOrCtx?: AppRouteHandlerFnContext | NextApiResponse) => {
			if (req instanceof Request) {
				return wrappedAppRoute(req, (resOrCtx ?? {}) as AppRouteHandlerFnContext);
			}

			return wrappedPageRoute(req as NextApiRequest, resOrCtx as NextApiResponse);
		}) as never;
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
		const config = {
			loginUrl: '/auth/login',
		};
		const appRouteHandler = appRouteHandlerFactory(getSession, config);
		const pageRouteHandler = pageRouteHandlerFactory(getSession, config);

		if (typeof fnOrOpts === 'function') {
			return appRouteHandler(fnOrOpts, opts);
		}

		return pageRouteHandler(fnOrOpts);
	}

	// endregion

	// region handlers

	async function handleSession(): Promise<NextResponse> {
		const session = await getSession();

		if (!session) {
			return new NextResponse('No active session', { status: 401 });
		}

		return NextResponse.json(session);
	}

	async function handleLogin(req: NextRequest): Promise<NextResponse> {
		const { returnTo, ...params } = Object.fromEntries(req.nextUrl.searchParams);
		const safeReturnTo = returnTo?.startsWith('/') ? returnTo : null;
		const authorizationUrl = await buildAuthorizationUrl({ params, options });

		if (safeReturnTo) {
			const store = await cookies();

			store.set(RETURN_TO_COOKIE, safeReturnTo, {
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				path: '/',
			});
		}

		options.logging?.debug('Attempting to redirect for login');

		return NextResponse.redirect(authorizationUrl);
	}

	async function handleRegister(req: NextRequest): Promise<NextResponse> {
		req.nextUrl.searchParams.set('prompt', 'create');

		return handleLogin(req);
	}

	async function handleCallback(req: NextRequest): Promise<NextResponse> {
		const params = Object.fromEntries(req.nextUrl.searchParams);

		try {
			await completeLogin(params);
		} catch (error) {
			return NextResponse.redirect(
				new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, req.nextUrl.origin),
			);
		}

		const returnTo = req.cookies.get(RETURN_TO_COOKIE)?.value ?? options.postLoginRedirectUri;
		const store = await cookies();

		store.delete(RETURN_TO_COOKIE);

		return NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
	}

	async function handleRefresh(req: NextRequest): Promise<NextResponse> {
		const returnTo = req.nextUrl.searchParams.get('returnTo');
		const safeReturnTo = returnTo?.startsWith('/') ? returnTo : null;

		try {
			await refreshSession();
		} catch (error) {
			if (error instanceof Error && error.message === 'No refresh token available') {
				const loginUrl = new URL(options.postLoginRedirectUri, req.nextUrl.origin);

				if (safeReturnTo) {
					loginUrl.searchParams.set('returnTo', safeReturnTo);
				}

				return NextResponse.redirect(loginUrl);
			}

			return NextResponse.redirect(
				new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, req.nextUrl.origin),
			);
		}

		if (safeReturnTo) {
			return NextResponse.redirect(new URL(safeReturnTo, req.nextUrl.origin));
		}

		return new NextResponse(null, { status: 204 });
	}

	async function handleRevoke(req: NextRequest): Promise<NextResponse> {
		const redirectUrl = new URL(options.postLogoutRedirectUri, req.nextUrl.origin);

		try {
			await revokeSession();
		} catch (error) {
			return NextResponse.redirect(
				new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, req.nextUrl.origin),
			);
		}

		return NextResponse.redirect(redirectUrl);
	}

	async function handleLogout(req: NextRequest): Promise<NextResponse> {
		try {
			const logoutUrl = await logout(new URL(options.postLogoutRedirectUri, req.nextUrl.origin));
			return NextResponse.redirect(logoutUrl);
		} catch (error) {
			return NextResponse.redirect(
				new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, req.nextUrl.origin),
			);
		}
	}

	async function handleBackchannelLogout(req: NextRequest): Promise<NextResponse> {
		if (!(options.storage && 'deleteByLogoutToken' in options.storage)) {
			return new NextResponse('Back-channel logout requires a storage with deleteByLogoutToken', { status: 501 });
		}

		const storage = options.storage as NextServerStorage;

		let logoutToken: string | null = null;

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

		const token: LogoutToken = {};

		if (claims.sid) {
			token.sid = claims.sid;
		}

		if (claims.sub) {
			token.sub = claims.sub;
		}

		try {
			await storage.deleteByLogoutToken(token);
		} catch (error) {
			return new NextResponse(`Failed to delete session: ${error instanceof Error ? error.message : 'unknown error'}`, { status: 500 });
		}

		return new NextResponse(null, { status: 200 });
	}

	async function handler(req: NextRequest): Promise<NextResponse> {
		const method = req.method;
		let { pathname } = req.nextUrl;

		if (req.nextUrl.basePath && pathname.startsWith(req.nextUrl.basePath)) {
			pathname = pathname.slice(req.nextUrl.basePath.length) || '/';
		}

		pathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

		if (method === 'GET' && pathname === '/auth/login') {
			return handleLogin(req);
		} else if (method === 'GET' && pathname === '/auth/register') {
			return handleRegister(req);
		} else if (method === 'GET' && pathname === '/auth/callback') {
			return handleCallback(req);
		} else if (method === 'GET' && pathname === '/auth/session') {
			return handleSession();
		} else if (method === 'GET' && pathname === '/auth/refresh') {
			return handleRefresh(req);
		} else if (method === 'GET' && pathname === '/auth/revoke') {
			return handleRevoke(req);
		} else if (method === 'GET' && pathname === '/auth/logout') {
			return handleLogout(req);
		} else if (method === 'POST' && pathname === '/auth/backchannel-logout') {
			return handleBackchannelLogout(req);
		}

		return new NextResponse('Not Found', { status: 404 });
	}

	async function middleware(req: Request | NextRequest): Promise<NextResponse> {
		const nextReq = toNextRequest(req);

		let { pathname } = nextReq.nextUrl;

		if (nextReq.nextUrl.basePath && pathname.startsWith(nextReq.nextUrl.basePath)) {
			pathname = pathname.slice(nextReq.nextUrl.basePath.length) || '/';
		}

		pathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

		if (pathname.startsWith('/auth')) {
			return handler(nextReq);
		}

		const res = NextResponse.next();
		const session = await getSession(nextReq);
		const loginUrl = new URL('/auth/login', nextReq.nextUrl.origin);

		loginUrl.searchParams.set('returnTo', pathname);

		if (!session && isProtectedRoute(pathname)) {
			return NextResponse.redirect(loginUrl);
		}

		if (session?.refresh_token && isSessionExpired(session)) {
			try {
				await refreshSession(nextReq, res);
			} catch {
				return NextResponse.redirect(loginUrl);
			}
		}

		return res;
	}

	return {
		get SSR() {
			return true;
		},
		get httpClient() {
			return options.httpClient;
		},
		myAccount,
		getSession,
		updateSession,
		refreshSession,
		revokeSession,
		completeLogin,
		logout,
		getLoginSession,
		withLoginSession,
		withAuthGuard,
		withApiAuthRequired,
		handleSession,
		handleLogin,
		handleRegister,
		handleCallback,
		handleRefresh,
		handleRevoke,
		handleLogout,
		handleBackchannelLogout,
		handler,
		middleware,
	};
}
