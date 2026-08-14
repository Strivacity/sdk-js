import type { SessionData, RemixServerSDK, RemixServerSDKOptions, RemixServerSDKInitConfig, LogoutTokenClaims } from './types';
import { redirect } from '@remix-run/node';
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
import { buildCookieString } from '@strivacity/sdk-core/utils/common';
import { createServerStateStorage, getEncryptedCookieStorage } from './storages';
import { proxyResponse, toSafeRedirect } from './utils';
import { withApiAuthRequiredFactory, withAuthGuardFactory } from './handlers/route';

const RETURN_TO_COOKIE = 'sty.returnTo';
const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

export function createServerSDK(opts: RemixServerSDKInitConfig): RemixServerSDK {
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

	const options = getSDKOptions<RemixServerSDKOptions>(getDefaultFlowState(), opts);
	const loginUrl = ['embedded', 'native'].includes(options.mode) ? options.loginUri : `${options.authUrlPrefix}/login`;

	// region helpers

	function getOrigin(request: Request): string {
		return new URL(request.url).origin;
	}

	function getSearchParams(request: Request): URLSearchParams {
		return new URL(request.url).searchParams;
	}

	function getPathname(request: Request): string {
		const pathname = new URL(request.url).pathname;
		return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
	}

	// endregion

	// region guards

	const withApiAuthRequired = withApiAuthRequiredFactory(getSession);
	const withAuthGuard = withAuthGuardFactory(getSession, loginUrl);

	// endregion

	// region session management

	async function getSession(req?: Request): Promise<SessionData | null> {
		return loadSession(await options.storage.get(options.storageTokenName, req));
	}

	async function updateSession(session: SessionData, req?: Request, res?: Response): Promise<void> {
		await options.storage.set(options.storageTokenName, serializeSession(session), req, res);
	}

	async function refreshSession(req?: Request, res?: Response): Promise<SessionData> {
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

	async function revokeSession(req?: Request, res?: Response): Promise<void> {
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

	async function completeLogin(params: Record<string, string>, req?: Request, res?: Response): Promise<SessionData> {
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

	async function logout(postLogoutRedirectUri?: string | URL, req?: Request, res?: Response): Promise<URL> {
		options.logging?.debug('Attempting to logout');

		const currentSession = await getSession(req);
		await options.storage.delete(options.storageTokenName, req, res);

		options.logging?.debug('Logout initiated');

		if (!currentSession?.id_token) {
			options.logging?.debug('Logout called without session');
			return new URL(postLogoutRedirectUri ?? options.postLogoutRedirectUri);
		}

		return buildEndSessionUrl({
			url: (await options.getMetadata()).end_session_endpoint,
			idToken: currentSession.id_token,
			postLogoutRedirectUri: new URL(postLogoutRedirectUri ?? options.postLogoutRedirectUri).toString(),
		});
	}

	// endregion

	// region handlers

	async function handleLogin(req: Request): Promise<Response> {
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

		const proxied = proxyResponse(startResponse);

		if (safeReturnTo) {
			const headers = new Headers(proxied.headers);
			headers.append(
				'set-cookie',
				buildCookieString(RETURN_TO_COOKIE, encodeURIComponent(safeReturnTo), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }),
			);
			return new Response(proxied.body, { status: proxied.status, headers });
		}

		return proxied;
	}

	async function handleLoginSession(req: Request): Promise<Response> {
		const params = Object.fromEntries(new URL(req.url).searchParams);
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

	async function handleRegister(req: Request): Promise<Response> {
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

		const proxied = proxyResponse(startResponse);

		if (safeReturnTo) {
			const headers = new Headers(proxied.headers);
			headers.append(
				'set-cookie',
				buildCookieString(RETURN_TO_COOKIE, encodeURIComponent(safeReturnTo), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }),
			);
			return new Response(proxied.body, { status: proxied.status, headers });
		}

		return proxied;
	}

	async function handleCallback(req: Request): Promise<Response> {
		const origin = getOrigin(req);
		const params = Object.fromEntries(getSearchParams(req));

		try {
			const serializedState = await options.stateStorage.get(`sty.${params.state}`);

			const sessionResponse = new Response();
			await completeLogin(params, req, sessionResponse);

			if (!serializedState) {
				throw new Error('State not found or expired. Please try logging in again.');
			}

			const state = parseState(serializedState);
			const returnToCookie = req.headers
				.get('cookie')
				?.split(';')
				.map((c) => c.trim())
				.find((c) => c.startsWith(`${RETURN_TO_COOKIE}=`))
				?.split('=')[1];
			const returnTo = returnToCookie ? decodeURIComponent(returnToCookie) : options.postLoginRedirectUri;

			const redirectResponse = redirect(new URL(returnTo, origin).toString());
			const headers = new Headers(redirectResponse.headers);

			for (const cookie of sessionResponse.headers.getSetCookie()) {
				headers.append('set-cookie', cookie);
			}

			headers.append('set-cookie', buildCookieString(RETURN_TO_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }));

			if (state.metadata?.display === 'popup') {
				// NOTE: If the login was initiated from a popup, we return a HTML page that will close the popup and notify the opener window.
				return new Response(`<!DOCTYPE html><html><body><script>window.opener?.postMessage({}, '*');window.close();</script></body></html>`, {
					headers: { ...headers, 'content-type': 'text/html; charset=utf-8' },
				});
			}

			return new Response(redirectResponse.body, { status: redirectResponse.status, headers });
		} catch (error) {
			return redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin).toString());
		}
	}

	async function handleRefresh(req: Request): Promise<Response> {
		const origin = getOrigin(req);
		const returnTo = getSearchParams(req).get('returnTo');
		const safeReturnTo = toSafeRedirect(returnTo, origin);

		try {
			const sessionResponse = new Response();
			await refreshSession(req, sessionResponse);

			if (safeReturnTo) {
				const redirectResponse = redirect(new URL(safeReturnTo, origin).toString());
				const headers = new Headers(redirectResponse.headers);

				for (const cookie of sessionResponse.headers.getSetCookie()) {
					headers.append('set-cookie', cookie);
				}

				return new Response(redirectResponse.body, { status: redirectResponse.status, headers });
			}

			return new Response(null, { status: 204 });
		} catch (error) {
			if (error instanceof Error && error.message === 'No refresh token available') {
				const uri = new URL(options.postLoginRedirectUri, origin);

				if (safeReturnTo) {
					uri.searchParams.set('returnTo', safeReturnTo);
				}

				return redirect(uri.toString());
			}

			return redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin).toString());
		}
	}

	async function handleRevoke(req: Request): Promise<Response> {
		const origin = getOrigin(req);
		const redirectUrl = new URL(options.postLogoutRedirectUri, origin);

		try {
			const sessionResponse = new Response();
			await revokeSession(req, sessionResponse);

			const redirectResponse = redirect(redirectUrl.toString());
			const headers = new Headers(redirectResponse.headers);

			for (const cookie of sessionResponse.headers.getSetCookie()) {
				headers.append('set-cookie', cookie);
			}

			return new Response(redirectResponse.body, { status: redirectResponse.status, headers });
		} catch (error) {
			return redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin).toString());
		}
	}

	async function handleEntry(req: Request): Promise<Response> {
		const origin = getOrigin(req);

		try {
			const data = await getEntrySession(req.url);
			const uri = new URL(loginUrl, origin);
			uri.searchParams.set('session_id', data.session_id);
			uri.searchParams.set('short_app_id', data.short_app_id);
			uri.searchParams.set('language', data.language);

			return redirect(uri.toString());
		} catch (error) {
			return redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin).toString());
		}
	}

	async function handleLogout(req: Request): Promise<Response> {
		const origin = getOrigin(req);

		try {
			const sessionResponse = new Response();
			const logoutUrl = await logout(new URL(options.postLogoutRedirectUri, origin), req, sessionResponse);

			const redirectResponse = redirect(logoutUrl.toString());
			const headers = new Headers(redirectResponse.headers);

			for (const cookie of sessionResponse.headers.getSetCookie()) {
				headers.append('set-cookie', cookie);
			}

			return new Response(redirectResponse.body, { status: redirectResponse.status, headers });
		} catch (error) {
			return redirect(new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin).toString());
		}
	}

	async function handleBackChannelLogout(req: Request): Promise<Response> {
		if (typeof options.storage.deleteByLogoutToken !== 'function') {
			return new Response('Back-channel logout requires a storage with deleteByLogoutToken', { status: 501 });
		}

		let logoutToken;

		try {
			const contentType = req.headers.get('content-type') ?? '';

			if (contentType.includes('application/x-www-form-urlencoded')) {
				const body = await req.formData();
				logoutToken = body.get('logout_token') as string | null;
			} else {
				return new Response('Invalid content type: expected application/x-www-form-urlencoded', { status: 400 });
			}
		} catch {
			return new Response('Failed to parse request body', { status: 400 });
		}

		if (!logoutToken) {
			return new Response('Missing logout_token', { status: 400 });
		}

		let claims: LogoutTokenClaims;

		try {
			claims = await verifyJwt<LogoutTokenClaims>(logoutToken, (await options.getMetadata()).jwks_uri);
		} catch (error) {
			return new Response(`Invalid logout_token: ${error instanceof Error ? error.message : 'verification failed'}`, { status: 400 });
		}

		if (claims.nonce !== undefined) {
			return new Response('Invalid logout_token: nonce claim must not be present', { status: 400 });
		}

		if (!claims.events || !(BACKCHANNEL_LOGOUT_EVENT in claims.events)) {
			return new Response(`Invalid logout_token: missing ${BACKCHANNEL_LOGOUT_EVENT} in events`, { status: 400 });
		}

		if (!claims.sid && !claims.sub) {
			return new Response('Invalid logout_token: must contain sid or sub claim', { status: 400 });
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
			return new Response(`Failed to delete session: ${error instanceof Error ? error.message : 'unknown error'}`, { status: 500 });
		}

		return new Response(null, { status: 200 });
	}

	async function handler(req: Request): Promise<Response> {
		const pathname = getPathname(req);

		if (req.method === 'GET' && pathname === `${options.authUrlPrefix}/login`) {
			if (['embedded', 'native'].includes(options.mode) && pathname !== loginUrl) {
				const uri = new URL(loginUrl, getOrigin(req));
				getSearchParams(req).forEach((v, k) => uri.searchParams.set(k, v));
				return redirect(uri.toString());
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

		return new Response('Not Found', { status: 404 });
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
