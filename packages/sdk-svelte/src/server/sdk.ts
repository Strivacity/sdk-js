import type { RequestEvent, Handle } from '@sveltejs/kit';
import type { SessionData, LogoutTokenClaims } from '@strivacity/sdk-core/types';
import type { SvelteKitServerSDK, SvelteKitServerSDKOptions, SvelteKitServerSDKInitConfig } from './types';
import { isRedirect, redirect, text } from '@sveltejs/kit';
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
import { loadSession, serializeSession, isSessionExpired } from '@strivacity/sdk-core/utils/session';
import { parseState } from '@strivacity/sdk-core/utils/state';
import { createServerStateStorage, getEncryptedCookieStorage } from './storages';
import { proxyResponse, toSafeRedirect, RETURN_TO_COOKIE, BACKCHANNEL_LOGOUT_EVENT } from './utils';

/**
 * Creates the Strivacity server SDK for SvelteKit: session management, auth route handlers, and the `handle` hook used in `hooks.server.ts`.
 *
 * @param {SvelteKitServerSDKInitConfig} opts - The configuration options for initializing the server SDK.
 * @returns {SvelteKitServerSDK} The initialized server SDK instance.
 */
export function createServerSDK(opts: SvelteKitServerSDKInitConfig): SvelteKitServerSDK {
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

	const options = getSDKOptions<SvelteKitServerSDKOptions>(getDefaultFlowState(), opts);
	const loginUrl = ['embedded', 'native'].includes(options.mode) ? options.loginUri : `${options.authUrlPrefix}/login`;

	// region guards

	async function requireSession(event: RequestEvent, guardOpts: { returnTo?: string } = {}): Promise<SessionData> {
		const session = await getSession(event);

		if (!session || isSessionExpired(session)) {
			const uri = new URL(loginUrl, event.url.origin);
			const returnTo = guardOpts.returnTo ?? `${event.url.pathname}${event.url.search}`;

			if (returnTo) {
				uri.searchParams.set('returnTo', returnTo);
			}

			redirect(302, uri);
		}

		return session;
	}

	// endregion

	// region session management

	async function getSession(event: RequestEvent): Promise<SessionData | null> {
		return loadSession(await options.storage.get(options.storageTokenName, event));
	}

	async function updateSession(event: RequestEvent, session: SessionData): Promise<void> {
		await options.storage.set(options.storageTokenName, serializeSession(session), event);
	}

	async function refreshSession(event: RequestEvent): Promise<SessionData> {
		options.logging?.debug('Attempting to refresh session');

		const currentSession = await getSession(event);

		if (typeof currentSession?.refresh_token !== 'string') {
			throw new Error('No refresh token available');
		}

		try {
			const newSession = await refreshToken({ refreshToken: currentSession.refresh_token, options });
			await options.storage.set(options.storageTokenName, serializeSession(newSession), event);

			options.logging?.debug('Session refresh successful');

			return newSession;
		} catch (error) {
			await options.storage.delete(options.storageTokenName, event);
			options.logging?.error('Session refresh failed', error);
			throw error;
		}
	}

	async function revokeSession(event: RequestEvent): Promise<void> {
		const currentSession = await getSession(event);
		const tokenTypeHint = currentSession?.refresh_token ? 'refresh_token' : 'access_token';
		const token = currentSession?.refresh_token ?? currentSession?.access_token ?? null;

		await options.storage.delete(options.storageTokenName, event);

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

	async function completeLogin(params: Record<string, string>, event: RequestEvent): Promise<SessionData> {
		options.logging?.debug('Exchanging authorization code for tokens');

		try {
			const session = await exchangeCode({ params, options });
			await options.storage.set(options.storageTokenName, serializeSession(session), event);

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

	async function logout(postLogoutRedirectUri: string | URL, event: RequestEvent): Promise<URL> {
		options.logging?.debug('Attempting to logout');

		const currentSession = await getSession(event);
		await options.storage.delete(options.storageTokenName, event);

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

	async function handleLogin(event: RequestEvent): Promise<Response> {
		const { returnTo, ...params } = Object.fromEntries(event.url.searchParams);
		const safeReturnTo = toSafeRedirect(returnTo, event.url.origin);
		const cookies: Array<string> = [];
		const url = await buildAuthorizationUrl({ params, options });
		const startResponse = await options.httpClient.request<string>(url, {
			method: 'GET',
			credentials: 'include',
			redirect: 'manual',
		});

		options.logging?.debug('Attempting to redirect for login');

		if (safeReturnTo) {
			cookies.push(event.cookies.serialize(RETURN_TO_COOKIE, safeReturnTo, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }));
		}

		return proxyResponse(startResponse, cookies);
	}

	async function handleLoginSession(event: RequestEvent): Promise<Response> {
		const params = Object.fromEntries(event.url.searchParams);
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

	async function handleRegister(event: RequestEvent): Promise<Response> {
		const { returnTo, ...params } = Object.fromEntries(event.url.searchParams);
		const safeReturnTo = toSafeRedirect(returnTo, event.url.origin);
		const cookies: Array<string> = [];
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
			cookies.push(event.cookies.serialize(RETURN_TO_COOKIE, safeReturnTo, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }));
		}

		return proxyResponse(startResponse, cookies);
	}

	async function handleCallback(event: RequestEvent): Promise<Response> {
		const params = Object.fromEntries(event.url.searchParams);

		try {
			const serializedState = await options.stateStorage.get(`sty.${params.state}`);

			await completeLogin(params, event);

			if (!serializedState) {
				throw new Error('State not found or expired. Please try logging in again.');
			}

			const state = parseState(serializedState);

			const returnTo = event.cookies.get(RETURN_TO_COOKIE) ?? options.postLoginRedirectUri;
			event.cookies.delete(RETURN_TO_COOKIE, { path: '/' });

			if (state.metadata?.display === 'popup') {
				// NOTE: If the login was initiated from a popup, we return a HTML page that will close the popup and notify the opener window.
				return text(`<!DOCTYPE html><html><body><script>window.opener?.postMessage({}, '*');window.close();</script></body></html>`, {
					headers: { 'content-type': 'text/html; charset=utf-8' },
				});
			}

			return redirect(302, new URL(returnTo, event.url.origin));
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}

			return redirect(302, new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, event.url.origin));
		}
	}

	async function handleRefresh(event: RequestEvent): Promise<Response> {
		const origin = event.url.origin;
		const returnTo = event.url.searchParams.get('returnTo');
		const safeReturnTo = toSafeRedirect(returnTo, origin);

		try {
			await refreshSession(event);

			if (safeReturnTo) {
				return redirect(302, new URL(safeReturnTo, origin));
			}

			return new Response(null, { status: 204 });
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}

			if (error instanceof Error && error.message === 'No refresh token available') {
				const uri = new URL(options.postLoginRedirectUri, origin);

				if (safeReturnTo) {
					uri.searchParams.set('returnTo', safeReturnTo);
				}

				return redirect(302, uri);
			}

			return redirect(302, new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin));
		}
	}

	async function handleRevoke(event: RequestEvent): Promise<Response> {
		const origin = event.url.origin;

		try {
			await revokeSession(event);
			return redirect(302, new URL(options.postLogoutRedirectUri, origin));
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}

			return redirect(302, new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin));
		}
	}

	async function handleEntry(event: RequestEvent): Promise<Response> {
		const origin = event.url.origin;

		try {
			const data = await getEntrySession(event.url);
			const uri = new URL(loginUrl, origin);
			uri.searchParams.set('session_id', data.session_id);
			uri.searchParams.set('short_app_id', data.short_app_id);
			uri.searchParams.set('language', data.language);

			return redirect(302, uri);
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}

			return redirect(302, new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin));
		}
	}

	async function handleLogout(event: RequestEvent): Promise<Response> {
		const origin = event.url.origin;

		try {
			const logoutUrl = await logout(new URL(options.postLogoutRedirectUri, origin), event);
			return redirect(302, logoutUrl);
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}

			return redirect(302, new URL(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, origin));
		}
	}

	async function handleBackchannelLogout(event: RequestEvent): Promise<Response> {
		if (typeof options.storage.deleteByLogoutToken !== 'function') {
			return new Response('Back-channel logout requires a storage with deleteByLogoutToken', { status: 501 });
		}

		let logoutToken;

		try {
			const contentType = event.request.headers.get('content-type') ?? '';

			if (contentType.includes('application/x-www-form-urlencoded')) {
				const body = await event.request.formData();
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

	const handle: Handle = async ({ event, resolve }) => {
		const pathname = event.url.pathname;

		if (event.request.method === 'GET' && pathname === `${options.authUrlPrefix}/login`) {
			if (['embedded', 'native'].includes(options.mode) && pathname !== loginUrl) {
				const uri = new URL(loginUrl, event.url.origin);
				event.url.searchParams.forEach((v, k) => uri.searchParams.set(k, v));
				return redirect(302, uri);
			}

			return handleLogin(event);
		} else if (event.request.method === 'GET' && pathname === `${options.authUrlPrefix}/login/session`) {
			return handleLoginSession(event);
		} else if (event.request.method === 'GET' && pathname === `${options.authUrlPrefix}/register`) {
			return handleRegister(event);
		} else if (event.request.method === 'GET' && pathname === `${options.authUrlPrefix}/callback`) {
			return handleCallback(event);
		} else if (event.request.method === 'GET' && pathname === `${options.authUrlPrefix}/refresh`) {
			return handleRefresh(event);
		} else if (event.request.method === 'GET' && pathname === `${options.authUrlPrefix}/revoke`) {
			return handleRevoke(event);
		} else if (event.request.method === 'GET' && pathname === `${options.authUrlPrefix}/entry`) {
			return handleEntry(event);
		} else if (event.request.method === 'GET' && pathname === `${options.authUrlPrefix}/logout`) {
			return handleLogout(event);
		} else if (event.request.method === 'POST' && pathname === `${options.authUrlPrefix}/backchannel-logout`) {
			return handleBackchannelLogout(event);
		}

		return resolve(event);
	};

	// endregion

	return {
		get httpClient() {
			return options.httpClient;
		},
		handle,
		getSession,
		updateSession,
		refreshSession,
		revokeSession,
		getEntrySession,
		completeLogin,
		logout,
		requireSession,
		handleLogin,
		handleLoginSession,
		handleRegister,
		handleCallback,
		handleRefresh,
		handleRevoke,
		handleEntry,
		handleLogout,
		handleBackchannelLogout,
	};
}
