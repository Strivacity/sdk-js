import type { SDKStorage } from '../types/common';
import type { SessionData, LogoutTokenClaims } from '../types/oidc';
import type { BaseServerSDK, ServerAdapter, ServerStorage, ServerSDKInitConfig } from '../types/server';
import {
	buildEndSessionUrl,
	buildAuthorizationUrl,
	revokeToken,
	refreshToken,
	exchangeCode,
	verifyJwt,
	fetchFlowEntry,
	getDiscoveryDocument,
} from '../utils/oidc';
import { loadSession, serializeSession } from '../utils/session';
import { parseState } from '../utils/state';
import { timestamp } from '../utils/common';
import { ConfigurationError, OidcError, ProtocolError, type FailureCategory } from '../utils/errors';
import {
	pushSetCookie,
	flushSetCookies,
	parseCookieHeader,
	serializeCookie,
	proxyResponse,
	toSafeRedirect,
	getServerSDKOptions,
	BACKCHANNEL_LOGOUT_EVENT,
} from '../utils/server';

export const COOKIE_CONTEXT = 'strivacity-session-v1';
export const COOKIE_CHUNK_SIZE = 3900;
export const DISALLOWED_PROXY_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);
export const RETURN_TO_COOKIE = 'sty.returnTo';
export const BACKCHANNEL_LOGOUT_TOKEN_MAX_AGE_SECONDS = 120;

/**
 * Creates the framework-agnostic Strivacity base server SDK.
 *
 * @param {ServerAdapter<TEvent>} adapter - The framework adapter converting `TEvent` to a standard `Request`.
 * @param {ServerSDKOptions<TEvent, Storage, StateStorage>} initConfig - The initial configuration for the server SDK.
 * @returns {BaseServerSDK<TEvent>} The initialized, framework-agnostic server SDK core.
 */
export function createBaseServerSDK<
	TEvent = unknown,
	Storage extends ServerStorage<TEvent> = ServerStorage<TEvent>,
	StateStorage extends SDKStorage = SDKStorage,
>(adapter: ServerAdapter<TEvent>, initConfig: ServerSDKInitConfig<TEvent, Storage, StateStorage>): BaseServerSDK<TEvent> {
	const options = getServerSDKOptions(adapter, initConfig);
	const seenLogoutTokenIds = new Map<string, number>();

	function init() {
		if (!options.issuer) {
			const error = new ConfigurationError('Missing option: issuer');
			options.logging?.error('Required option missing', error);
			throw error;
		}
		if (!options.clientId) {
			const error = new ConfigurationError('Missing option: clientId');
			options.logging?.error('Required option missing', error);
			throw error;
		}
		if (!options.redirectUri) {
			const error = new ConfigurationError('Missing option: redirectUri');
			options.logging?.error('Required option missing', error);
			throw error;
		}
		if (options.scopes && !Array.isArray(options.scopes)) {
			const error = new ConfigurationError('Invalid option: scopes');
			options.logging?.error('Invalid option provided', error);
			throw error;
		}
	}

	async function redirect(url: string | URL, status = 302, event?: TEvent): Promise<Response> {
		if (adapter.redirect) {
			return await adapter.redirect(url, status, event);
		}

		return new Response(null, { status, headers: { location: url.toString() } });
	}

	async function errorRedirect(origin: string, error: unknown, event?: TEvent): Promise<Response> {
		const url = new URL('/error', origin);

		if (error instanceof OidcError) {
			url.searchParams.set('type', error.category.toLowerCase());
			url.searchParams.set('error', error.error);
			if (error.errorDescription) {
				url.searchParams.set('error_description', error.errorDescription);
			}
		} else if (error instanceof Error && 'category' in error) {
			url.searchParams.set('type', (error as { category: FailureCategory }).category.toLowerCase());
			url.searchParams.set('error', error.name);
			url.searchParams.set('error_description', error.message);
		} else {
			url.searchParams.set('type', 'unknown');
			url.searchParams.set('error', 'unknown_error');
			url.searchParams.set('error_description', error instanceof Error ? error.message : 'Unknown error');
		}

		return redirect(url, 302, event);
	}

	async function getSession(event?: TEvent): Promise<SessionData | null> {
		return loadSession(await options.storage.get(options.storageTokenName, event));
	}

	async function updateSession(session: SessionData, event?: TEvent): Promise<void> {
		await options.storage.set(options.storageTokenName, serializeSession(session), event);
	}

	async function cleanupSession(event?: TEvent): Promise<void> {
		await options.storage.delete(options.storageTokenName, event);
	}

	async function refreshSession(event?: TEvent): Promise<SessionData> {
		options.logging?.debug('Attempting to refresh session');

		const currentSession = await getSession(event);

		if (!currentSession) {
			throw new ProtocolError('No session available to refresh');
		}

		if (typeof currentSession.refresh_token !== 'string') {
			throw new ConfigurationError('No refresh token available');
		}

		try {
			const newSession = await refreshToken({ refreshToken: currentSession.refresh_token, options, expectedSub: currentSession.claims?.sub });
			await updateSession(newSession, event);

			options.logging?.debug('Session refresh successful');

			return newSession;
		} catch (error) {
			await cleanupSession(event);
			options.logging?.error('Session refresh failed', error as Error);

			throw error;
		}
	}

	async function revokeSession(event?: TEvent): Promise<void> {
		const currentSession = await getSession(event);

		if (currentSession?.refresh_token) {
			options.logging?.debug('Attempting to revoke refresh token');
		} else {
			options.logging?.debug('Attempting to revoke access token');
		}

		// NOTE: Cleanup session before revocation
		await cleanupSession(event);

		if (!currentSession?.access_token && !currentSession?.refresh_token) {
			options.logging?.debug('Revoke called without session');
			return;
		}

		const tokenTypeHint = currentSession.refresh_token ? 'refresh_token' : 'access_token';
		const token = (tokenTypeHint === 'refresh_token' ? currentSession.refresh_token : currentSession.access_token)!;

		try {
			await revokeToken({ tokenTypeHint, token, options });

			if (tokenTypeHint === 'refresh_token') {
				options.logging?.info('Refresh token successfully revoked');
			} else {
				options.logging?.info('Access token successfully revoked');
			}
		} catch (error) {
			options.logging?.error('Token revocation failed', error as Error);
			throw error;
		}
	}

	async function getEntrySession(entryUrl: string | URL): Promise<Record<string, string>> {
		options.logging?.debug('Attempting entry request');

		const { searchParams: params } = new URL(entryUrl);

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
			options.logging?.error('Entry request failed', error as Error);
			throw error;
		}
	}

	async function completeLogin(params: Record<string, string>, event?: TEvent): Promise<SessionData> {
		options.logging?.debug('Exchanging authorization code for tokens');

		try {
			const session = await exchangeCode({ params, options });

			if (!session.access_token) {
				throw new ProtocolError('Missing access_token');
			}

			await updateSession(session, event);

			options.logging?.debug('Token exchange successful');

			if (options.logging) {
				options.logging.xEventId = undefined;
				options.logging.info('Login successful');
			}

			return session;
		} catch (error) {
			options.logging?.error('Token exchange failed', error as Error);
			throw error;
		}
	}

	async function logout(postLogoutRedirectUri: string | URL, event?: TEvent): Promise<URL> {
		options.logging?.debug('Attempting to logout');

		// NOTE: Cleanup session before logout
		const currentSession = await getSession(event);
		await cleanupSession(event);

		options.logging?.debug('Logout initiated');

		if (!currentSession?.id_token) {
			options.logging?.debug('Logout called without id token');
			return new URL(postLogoutRedirectUri);
		}

		const metadata = await getDiscoveryDocument(options);

		return buildEndSessionUrl({
			url: metadata.end_session_endpoint,
			idToken: currentSession.id_token,
			postLogoutRedirectUri: new URL(postLogoutRedirectUri).toString(),
		});
	}

	async function handleLogin(event: TEvent, extraParams: Record<string, unknown> = {}): Promise<Response> {
		const request = await adapter.toRequest(event);
		const requestUrl = new URL(request.url);
		const { returnTo, ...params } = Object.fromEntries(requestUrl.searchParams);
		const safeReturnTo = toSafeRedirect(returnTo, requestUrl.origin);
		const url = await buildAuthorizationUrl({ params: { ...params, ...extraParams }, options });

		if (returnTo && !safeReturnTo) {
			throw new ProtocolError(`Invalid returnTo URL: ${returnTo}. Expected a URL with the same origin as the request: ${requestUrl.origin}`);
		}

		if (['embedded', 'native'].includes(options.mode) && params.sdk) {
			url.searchParams.set('sdk', params.sdk);
		}

		const startResponse = await options.httpClient.request<string>(url, {
			method: 'GET',
			credentials: 'include',
			redirect: 'manual',
		});

		options.logging?.debug('Attempting to redirect for login');

		if (safeReturnTo) {
			pushSetCookie(event, serializeCookie(RETURN_TO_COOKIE, safeReturnTo));
		}

		return flushSetCookies(event, proxyResponse(startResponse));
	}

	async function handleRegister(event: TEvent): Promise<Response> {
		return handleLogin(event, { prompt: 'create' });
	}

	async function handleCallback(event: TEvent): Promise<Response> {
		const request = await adapter.toRequest(event);
		const requestUrl = new URL(request.url);
		const params = Object.fromEntries(requestUrl.searchParams);

		try {
			const serializedState = await options.stateStorage.get(`sty.${params.state}`);

			if (!serializedState) {
				throw new ProtocolError('State not found or expired. Please try logging in again.');
			}

			await completeLogin(params, event);

			const state = parseState(serializedState);
			const returnTo = parseCookieHeader(request.headers.get('cookie'))[RETURN_TO_COOKIE] ?? options.postLoginRedirectUri;

			pushSetCookie(event, serializeCookie(RETURN_TO_COOKIE, '', { expires: new Date(0) }));

			if (state.metadata?.display === 'popup') {
				// NOTE: If the login was initiated from a popup, we return a HTML page that will close the popup and notify the opener window.
				return flushSetCookies(
					event,
					new Response(`<!DOCTYPE html><html><body><script>window.opener?.postMessage({}, '*');window.close();</script></body></html>`, {
						headers: { 'content-type': 'text/html; charset=utf-8' },
					}),
				);
			}

			return flushSetCookies(event, await redirect(new URL(returnTo, requestUrl.origin), 302, event));
		} catch (error) {
			return flushSetCookies(event, await errorRedirect(requestUrl.origin, error, event));
		}
	}

	async function handleRefresh(event: TEvent): Promise<Response> {
		const request = await adapter.toRequest(event);
		const requestUrl = new URL(request.url);
		const origin = requestUrl.origin;
		const returnTo = requestUrl.searchParams.get('returnTo');
		const safeReturnTo = toSafeRedirect(returnTo, origin);

		if (returnTo && !safeReturnTo) {
			throw new ProtocolError(`Invalid returnTo URL: ${returnTo}. Expected a URL with the same origin as the request: ${requestUrl.origin}`);
		}

		try {
			await refreshSession(event);

			if (safeReturnTo) {
				return flushSetCookies(event, await redirect(new URL(safeReturnTo, origin), 302, event));
			}

			return flushSetCookies(event, new Response(null, { status: 204 }));
		} catch (error) {
			return flushSetCookies(event, await errorRedirect(origin, error, event));
		}
	}

	async function handleRevoke(event: TEvent): Promise<Response> {
		const request = await adapter.toRequest(event);
		const origin = new URL(request.url).origin;

		try {
			await revokeSession(event);

			return flushSetCookies(event, await redirect(new URL(options.postLogoutRedirectUri, origin), 302, event));
		} catch (error) {
			return flushSetCookies(event, await errorRedirect(origin, error, event));
		}
	}

	async function handleEntry(event: TEvent): Promise<Response> {
		const request = await adapter.toRequest(event);
		const origin = new URL(request.url).origin;

		try {
			const data = await getEntrySession(request.url);
			const uri = new URL(options.loginUri, origin);
			uri.searchParams.set('session_id', data.session_id);
			uri.searchParams.set('short_app_id', data.short_app_id);
			uri.searchParams.set('language', data.language);

			return flushSetCookies(event, await redirect(uri, 302, event));
		} catch (error) {
			return flushSetCookies(event, await errorRedirect(origin, error, event));
		}
	}

	async function handleLogout(event: TEvent): Promise<Response> {
		const request = await adapter.toRequest(event);
		const origin = new URL(request.url).origin;

		try {
			const logoutUrl = await logout(new URL(options.postLogoutRedirectUri, origin), event);
			return flushSetCookies(event, await redirect(logoutUrl, 302, event));
		} catch (error) {
			return flushSetCookies(event, await errorRedirect(origin, error, event));
		}
	}

	async function handleBackChannelLogout(event: TEvent): Promise<Response> {
		if (typeof options.storage.deleteByLogoutToken !== 'function') {
			return new Response('Back-channel logout requires a storage with deleteByLogoutToken', { status: 501 });
		}

		const request = await adapter.toRequest(event);
		let logoutToken: string | null;

		try {
			const contentType = request.headers.get('content-type') ?? '';

			if (contentType.includes('application/x-www-form-urlencoded')) {
				const body = await request.formData();
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

		const now = timestamp();

		for (const [token, expiresAt] of seenLogoutTokenIds) {
			if (expiresAt <= now) {
				seenLogoutTokenIds.delete(token);
			}
		}

		if (seenLogoutTokenIds.has(logoutToken)) {
			return new Response('Invalid logout_token: token already used', { status: 400 });
		}

		seenLogoutTokenIds.set(logoutToken, now + BACKCHANNEL_LOGOUT_TOKEN_MAX_AGE_SECONDS);

		let claims;
		let metadata;

		try {
			metadata = await getDiscoveryDocument(options);
			claims = await verifyJwt<LogoutTokenClaims>({ token: logoutToken, jwksUri: metadata.jwks_uri, options });
		} catch (error) {
			return new Response(`Invalid logout_token: ${error.message}`, { status: 400 });
		}

		if (claims.iss !== metadata.issuer) {
			return new Response('Invalid logout_token: invalid iss claim', { status: 400 });
		}

		if (Array.isArray(claims.aud) ? !claims.aud.includes(options.clientId) : claims.aud !== options.clientId) {
			return new Response('Invalid logout_token: invalid aud claim', { status: 400 });
		}

		if (typeof claims.iat !== 'number' || Math.abs(now - claims.iat) > BACKCHANNEL_LOGOUT_TOKEN_MAX_AGE_SECONDS) {
			return new Response('Invalid logout_token: invalid or stale iat claim', { status: 400 });
		}

		if (!claims.jti) {
			return new Response('Invalid logout_token: missing jti claim', { status: 400 });
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

		const token: LogoutTokenClaims = {} as never;

		if (claims.sid) {
			token.sid = claims.sid;
		}
		if (claims.sub) {
			token.sub = claims.sub;
		}

		try {
			await options.storage.deleteByLogoutToken(token);
		} catch (error) {
			return new Response(`Failed to delete session: ${error.message}`, { status: 500 });
		}

		return new Response(null, { status: 200 });
	}

	async function handler(event: TEvent): Promise<Response | null> {
		const request = await adapter.toRequest(event);
		const requestUrl = new URL(request.url);

		if (request.method === 'GET' && requestUrl.pathname === `${options.authUrlPrefix}/login`) {
			return handleLogin(event);
		}
		if (request.method === 'GET' && requestUrl.pathname === `${options.authUrlPrefix}/register`) {
			return handleRegister(event);
		}
		if (request.method === 'GET' && requestUrl.pathname === `${options.authUrlPrefix}/callback`) {
			return handleCallback(event);
		}
		if (request.method === 'GET' && requestUrl.pathname === `${options.authUrlPrefix}/refresh`) {
			return handleRefresh(event);
		}
		if (request.method === 'GET' && requestUrl.pathname === `${options.authUrlPrefix}/revoke`) {
			return handleRevoke(event);
		}
		if (request.method === 'GET' && requestUrl.pathname === `${options.authUrlPrefix}/entry`) {
			return handleEntry(event);
		}
		if (request.method === 'GET' && requestUrl.pathname === `${options.authUrlPrefix}/logout`) {
			return handleLogout(event);
		}
		if (request.method === 'POST' && requestUrl.pathname === `${options.authUrlPrefix}/backchannel-logout`) {
			return handleBackChannelLogout(event);
		}

		return null;
	}

	// endregion

	init();

	return {
		get options() {
			return options;
		},
		getSession,
		updateSession,
		refreshSession,
		revokeSession,
		getEntrySession,
		completeLogin,
		logout,
		handleLogin,
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
