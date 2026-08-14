import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { AngularServerRequest, AngularServerSDK, AngularServerSDKInitConfig, AngularServerSDKOptions, LogoutTokenClaims, SessionData } from './types';
import { Router, urlencoded } from 'express';
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
import { createServerStateStorage, getCookieFromRequest, getEncryptedCookieStorage } from './storages';
import { getOrigin, proxyResponse, toSafeRedirect } from './utils';

const RETURN_TO_COOKIE = 'sty.returnTo';
const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

/**
 * Creates the server-side Strivacity SDK: an Express router exposing the auth endpoints and session helpers that can be reused elsewhere on the server.
 *
 * @param {AngularServerSDKInitConfig} opts - The SDK configuration options.
 * @returns {AngularServerSDK} The server-side SDK instance.
 */
export function createServerSDK(opts: AngularServerSDKInitConfig): AngularServerSDK {
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

	const options = getSDKOptions<AngularServerSDKOptions>(getDefaultFlowState(), opts);
	const loginUrl = ['embedded', 'native'].includes(options.mode) ? options.loginUri : `${options.authUrlPrefix}/login`;

	// region session management

	async function getSession(req?: AngularServerRequest): Promise<SessionData | null> {
		return loadSession(await options.storage.get(options.storageTokenName, req));
	}

	async function updateSession(session: SessionData, req?: ExpressRequest, res?: ExpressResponse): Promise<void> {
		await options.storage.set(options.storageTokenName, serializeSession(session), req, res);
	}

	async function refreshSession(req?: ExpressRequest, res?: ExpressResponse): Promise<SessionData> {
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
			options.logging?.error('Session refresh failed', error as Error);
			throw error;
		}
	}

	async function revokeSession(req?: ExpressRequest, res?: ExpressResponse): Promise<void> {
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
			options.logging?.error('Token revocation failed', error as Error);
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
			options.logging?.error('Entry request failed', error as Error);
			throw error;
		}
	}

	async function completeLogin(params: Record<string, string>, req?: ExpressRequest, res?: ExpressResponse): Promise<SessionData> {
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
			options.logging?.error('Token exchange failed', error as Error);
			throw error;
		}
	}

	async function logout(postLogoutRedirectUri: string | URL, req?: ExpressRequest, res?: ExpressResponse): Promise<URL> {
		options.logging?.debug('Attempting to logout');

		const currentSession = await getSession(req);
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

	async function handleLogin(req: ExpressRequest, res: ExpressResponse) {
		const { returnTo, ...params } = req.query as Record<string, string>;
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
			res.cookie(RETURN_TO_COOKIE, safeReturnTo, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
		}

		return proxyResponse(startResponse, res);
	}

	async function handleLoginSession(req: ExpressRequest, res: ExpressResponse) {
		const params = req.query as Record<string, string>;
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

		return proxyResponse(startResponse, res);
	}

	async function handleRegister(req: ExpressRequest, res: ExpressResponse) {
		const origin = getOrigin(req);
		const { returnTo, ...params } = req.query as Record<string, string>;
		const safeReturnTo = toSafeRedirect(returnTo, origin);
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
			res.cookie(RETURN_TO_COOKIE, safeReturnTo, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
		}

		return proxyResponse(startResponse, res);
	}

	async function handleCallback(req: ExpressRequest, res: ExpressResponse) {
		const origin = getOrigin(req);
		const params = req.query as Record<string, string>;

		try {
			const serializedState = await options.stateStorage.get(`sty.${params.state}`);

			await completeLogin(params, req, res);

			if (!serializedState) {
				throw new Error('State not found or expired. Please try logging in again.');
			}

			const state = parseState(serializedState);
			const returnTo = getCookieFromRequest(req, RETURN_TO_COOKIE) ?? options.postLoginRedirectUri;
			res.clearCookie(RETURN_TO_COOKIE);

			if (state.metadata?.display === 'popup') {
				// NOTE: If the login was initiated from a popup, we return a HTML page that will close the popup and notify the opener window.
				return res
					.set('content-type', 'text/html; charset=utf-8')
					.send(`<!DOCTYPE html><html><body><script>window.opener?.postMessage({}, '*');window.close();</script></body></html>`);
			}

			return res.redirect(new URL(returnTo, origin).toString());
		} catch (error) {
			return res.redirect(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	}

	async function handleRefresh(req: ExpressRequest, res: ExpressResponse) {
		const origin = getOrigin(req);
		const returnTo = (req.query.returnTo as string) ?? null;
		const safeReturnTo = toSafeRedirect(returnTo, origin);

		try {
			await refreshSession(req, res);

			if (safeReturnTo) {
				res.redirect(new URL(safeReturnTo, origin).toString());
				return;
			}

			return res.status(204).end();
		} catch (error) {
			if (error instanceof Error && error.message === 'No refresh token available') {
				const uri = new URL(options.postLoginRedirectUri, origin);

				if (safeReturnTo) {
					uri.searchParams.set('returnTo', safeReturnTo);
				}

				res.redirect(uri.toString());
				return;
			}

			return res.redirect(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	}

	async function handleRevoke(req: ExpressRequest, res: ExpressResponse) {
		const origin = getOrigin(req);
		const redirectUrl = new URL(options.postLogoutRedirectUri, origin);

		try {
			await revokeSession(req, res);
			return res.redirect(redirectUrl.toString());
		} catch (error) {
			return res.redirect(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	}

	async function handleEntry(req: ExpressRequest, res: ExpressResponse) {
		const origin = getOrigin(req);

		try {
			const data = await getEntrySession(`${origin}${req.originalUrl}`);
			const uri = new URL(loginUrl, origin);
			uri.searchParams.set('session_id', data.session_id);
			uri.searchParams.set('short_app_id', data.short_app_id);
			uri.searchParams.set('language', data.language);

			return res.redirect(uri.toString());
		} catch (error) {
			return res.redirect(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	}

	async function handleLogout(req: ExpressRequest, res: ExpressResponse) {
		const origin = getOrigin(req);

		try {
			const logoutUrl = await logout(new URL(options.postLogoutRedirectUri, origin), req, res);
			return res.redirect(logoutUrl.toString());
		} catch (error) {
			return res.redirect(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
		}
	}

	async function handleBackChannelLogout(req: ExpressRequest, res: ExpressResponse) {
		if (typeof options.storage.deleteByLogoutToken !== 'function') {
			res.status(501).send('Back-channel logout requires a storage with deleteByLogoutToken');
			return;
		}

		const logoutToken = (req.body as Record<string, string> | undefined)?.logout_token ?? null;

		if (!logoutToken) {
			return res.status(400).send('Missing logout_token');
		}

		let claims: LogoutTokenClaims;

		try {
			claims = await verifyJwt<LogoutTokenClaims>(logoutToken, (await options.getMetadata()).jwks_uri);
		} catch (error) {
			return res.status(400).send(`Invalid logout_token: ${error instanceof Error ? error.message : 'verification failed'}`);
		}

		if (claims.nonce !== undefined) {
			return res.status(400).send('Invalid logout_token: nonce claim must not be present');
		}

		if (!claims.events || !(BACKCHANNEL_LOGOUT_EVENT in claims.events)) {
			return res.status(400).send(`Invalid logout_token: missing ${BACKCHANNEL_LOGOUT_EVENT} in events`);
		}

		if (!claims.sid && !claims.sub) {
			return res.status(400).send('Invalid logout_token: must contain sid or sub claim');
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

			return res.status(200).end();
		} catch (error) {
			return res.status(500).send(`Failed to delete session: ${error instanceof Error ? error.message : 'unknown error'}`);
		}
	}

	// endregion

	const router = Router();

	router.get('/login', (req, res, next) => void handleLogin(req, res).catch(next));
	router.get('/login/session', (req, res, next) => void handleLoginSession(req, res).catch(next));
	router.get('/register', (req, res, next) => void handleRegister(req, res).catch(next));
	router.get('/callback', (req, res, next) => void handleCallback(req, res).catch(next));
	router.get('/refresh', (req, res, next) => void handleRefresh(req, res).catch(next));
	router.get('/revoke', (req, res, next) => void handleRevoke(req, res).catch(next));
	router.get('/entry', (req, res, next) => void handleEntry(req, res).catch(next));
	router.get('/logout', (req, res, next) => void handleLogout(req, res).catch(next));
	router.post('/backchannel-logout', urlencoded({ extended: false }), (req, res, next) => void handleBackChannelLogout(req, res).catch(next));

	return {
		get httpClient() {
			return options.httpClient;
		},
		router,
		getSession,
		updateSession,
		refreshSession,
		revokeSession,
		logout,
	};
}
