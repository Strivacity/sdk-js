import type { EventFunctions, ExtraRequestArgs, FlowState, SDK, SDKOptions, SessionData } from '../types/oidc';
import { buildEndSessionUrl, exchangeCode, getDiscoveryDocument, refreshToken, revokeToken, verifyIdToken } from '../utils/oidc';
import { loadSession, serializeSession, isSessionExpired } from '../utils/session';
import { parseState } from '../utils/state';
import { appendReturnTo } from '../utils/path';
import { ConfigurationError, NetworkError, ProtocolError, ServerError } from '../utils/errors';
import { redirectUriHandler } from '../handlers/redirect';

/**
 * Creates a base flow for the Strivacity SDK, providing common functionality for managing authentication sessions.
 *
 * @param flowState - The initial state of the flow, including session data and initialization status.
 * @param options - The SDK options, including issuer, clientId, redirectUri, scopes, and storage configuration.
 * @template URIHandlerParams - The type of additional request arguments for URL handling.
 * @returns An object implementing the SDK interface, with methods for initializing the flow, managing sessions, and handling authentication events.
 */
export function createBaseFlow<URIHandlerParams extends ExtraRequestArgs = ExtraRequestArgs>(flowState: FlowState, options: SDKOptions) {
	const promises: Record<'init' | 'refresh' | 'revoke' | 'logout', Promise<void> | null> & { tokenExchange: Map<string, Promise<void>> } = {
		init: null,
		refresh: null,
		revoke: null,
		logout: null,
		tokenExchange: new Map(),
	};
	let localSessionLock: Promise<unknown> = Promise.resolve();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const eventCallbacks: Record<keyof EventFunctions, Set<(...args: Array<any>) => Promise<void> | void>> = {
		accessTokenExpired: new Set(),
		init: new Set(),
		loggedIn: new Set(),
		sessionUpdated: new Set(),
		sessionCleared: new Set(),
		loginInitiated: new Set(),
		flowInitiated: new Set(),
		logoutInitiated: new Set(),
		sessionLoaded: new Set(),
		tokenRefreshed: new Set(),
		tokenRefreshFailed: new Set(),
		tokenRevoked: new Set(),
		tokenRevokeFailed: new Set(),
	};

	function dispatchEvent<T extends keyof EventFunctions>(eventName: T, args: Parameters<EventFunctions[T]>): void {
		for (const fn of eventCallbacks[eventName]) {
			void fn(...args);
		}
	}

	function subscribeToEvent<T extends keyof EventFunctions>(
		eventName: T,
		callbackFn: (...params: Parameters<EventFunctions[T]>) => Promise<void> | void,
	): ReturnType<SDK<URIHandlerParams>['subscribeToEvent']> {
		eventCallbacks[eventName].add(callbackFn);
		return { dispose: () => eventCallbacks[eventName].delete(callbackFn) };
	}

	function subscribeToAllEvents(callbackFn: (...params: Array<unknown>) => Promise<void> | void): ReturnType<SDK<URIHandlerParams>['subscribeToAllEvents']> {
		for (const eventName in eventCallbacks) {
			eventCallbacks[eventName as keyof EventFunctions].add(callbackFn);
		}

		return {
			dispose: () => {
				for (const eventName in eventCallbacks) {
					eventCallbacks[eventName as keyof EventFunctions].delete(callbackFn);
				}
			},
		};
	}

	function withSessionLock<T>(fn: () => Promise<T>): Promise<T> {
		const locks = globalThis.window ? (globalThis.navigator as Navigator | undefined)?.locks : undefined;

		if (locks) {
			return locks.request(`strivacity.session.${options.clientId}.${options.storageKey}`, fn);
		}

		// NOTE: in-process fallback of the session lock where the Web Locks API is not available
		const result = localSessionLock.then(fn);
		localSessionLock = result.catch(() => {});

		return result;
	}

	async function getSession(): Promise<SessionData | null> {
		await init();

		return flowState.session;
	}

	async function loadStoredSession(): Promise<SessionData | null> {
		if (options.serverSessionUri) {
			return null;
		}

		return loadSession(await options.storage.get(options.storageKey));
	}

	async function updateSession(newData: SessionData): ReturnType<SDK<URIHandlerParams>['updateSession']> {
		await init();

		// NOTE: only unverified callers (e.g. direct API use) need validating here
		if (newData.id_token && !newData.claims) {
			newData.claims = await verifyIdToken({ idToken: newData.id_token, options });
		}

		if (!options.serverSessionUri) {
			await options.storage.set(options.storageKey, serializeSession(newData));
		}

		flowState.session = newData;

		dispatchEvent('sessionUpdated', [
			{
				idToken: flowState.session.id_token,
				accessToken: flowState.session.access_token,
				refreshToken: flowState.session.refresh_token,
				claims: flowState.session.claims,
			},
		]);
	}

	async function cleanupSession(): ReturnType<SDK<URIHandlerParams>['cleanupSession']> {
		await init();

		if (!options.serverSessionUri) {
			await options.storage.delete(options.storageKey);
		}

		flowState.session = null;

		dispatchEvent('sessionCleared', []);
	}

	async function checkAuthentication(
		params: { autoRefresh: boolean } = { autoRefresh: options.autoRefresh },
	): ReturnType<SDK<URIHandlerParams>['checkAuthentication']> {
		await init();

		if (flowState.session?.access_token && !isSessionExpired(flowState.session, options.refreshSkew)) {
			return true;
		}

		if (params?.autoRefresh && flowState.session?.refresh_token && !options.serverSessionUri) {
			try {
				await refresh();
			} catch {
				return false;
			}
		}

		return !isSessionExpired(flowState.session);
	}

	async function init(): ReturnType<SDK<URIHandlerParams>['init']> {
		if (flowState.initialized) {
			return;
		}

		if (promises.init) {
			return promises.init;
		}

		promises.init = (async () => {
			try {
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

				if (!options.serverSessionUri) {
					flowState.session = loadSession(await options.storage.get(options.storageKey));
				}

				flowState.initialized = true;

				dispatchEvent('init', []);
				options.logging?.debug('SDK initialized');

				if (!flowState.session && !options.serverSessionUri) {
					options.logging?.debug('No session found in storage');
				}

				if (flowState.session?.access_token) {
					dispatchEvent('sessionLoaded', [
						{
							idToken: flowState.session.id_token,
							accessToken: flowState.session.access_token,
							refreshToken: flowState.session.refresh_token,
							claims: flowState.session.claims,
						},
					]);
					options.logging?.debug('Session loaded from storage');
				}

				if (flowState.session?.access_token && isSessionExpired(flowState.session)) {
					dispatchEvent('accessTokenExpired', [{ accessToken: flowState.session.access_token, refreshToken: flowState.session.refresh_token }]);
					options.logging?.debug('Access token has expired');
				}
			} finally {
				promises.init = null;
			}
		})();

		return promises.init;
	}

	async function tokenExchange(params: Parameters<SDK<URIHandlerParams>['tokenExchange']>[0] = {}): ReturnType<SDK<URIHandlerParams>['tokenExchange']> {
		await init();

		const exchangeKey = params.state ?? '';
		const inFlight = promises.tokenExchange.get(exchangeKey);

		if (inFlight) {
			return inFlight;
		}

		const exchangePromise = (async () => {
			options.logging?.debug('Exchanging authorization code for tokens');

			try {
				const session = await exchangeCode({ params, options });

				if (!session.access_token) {
					throw new ProtocolError('Missing access_token');
				}

				await updateSession(session);

				options.logging?.debug('Token exchange successful');

				dispatchEvent('loggedIn', [
					{ idToken: session.id_token, accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
				]);

				if (options.logging) {
					options.logging.xEventId = undefined;
					options.logging.info('Login successful');
				}
			} catch (error) {
				options.logging?.error('Token exchange failed', error);
				throw error;
			} finally {
				promises.tokenExchange.delete(exchangeKey);
			}
		})();

		promises.tokenExchange.set(exchangeKey, exchangePromise);

		return exchangePromise;
	}

	async function handleCallback(url?: string | URL): ReturnType<SDK<URIHandlerParams>['handleCallback']> {
		await init();

		const callbackUrl = url ?? globalThis.window?.location.href;
		const params = (await options.callbackHandler(callbackUrl, options.responseMode)) as Record<string, string>;
		// NOTE: read before the exchange, which deletes the state
		const serializedState = params.state ? await options.stateStorage.get(`sty.${params.state}`) : null;
		let returnTo: unknown;

		try {
			returnTo = serializedState ? parseState(serializedState).metadata?.returnTo : undefined;
		} catch {
			// NOTE: an unparsable state has no returnTo
		}

		await tokenExchange(params);

		return typeof returnTo === 'string' && returnTo ? { returnTo } : {};
	}

	async function refresh(params?: { returnTo?: string }): ReturnType<SDK<URIHandlerParams>['refresh']> {
		await init();

		if (promises.refresh) {
			return promises.refresh;
		}

		options.logging?.debug('Attempting to refresh session');

		// NOTE: with server-managed sessions the server owns the refresh token: let its refresh route rotate the cookie and come back
		if (options.serverSessionUri) {
			await redirectUriHandler(appendReturnTo(`${options.authUriPrefix}/refresh`, params?.returnTo));
			return;
		}

		if (typeof flowState.session?.refresh_token !== 'string') {
			options.logging?.debug('Refresh called without refresh token');
			return;
		}

		promises.refresh = withSessionLock(async () => {
			const stored = await loadStoredSession();

			if (!stored && !options.serverSessionUri) {
				if (flowState.session) {
					options.logging?.debug('Session was cleared by another tab');
					flowState.session = null;
					dispatchEvent('sessionCleared', []);
				}
				return;
			}

			if (stored?.access_token && stored.access_token !== flowState.session?.access_token) {
				options.logging?.debug('Using the session refreshed by another tab');
				flowState.session = stored;

				if (!isSessionExpired(stored, options.refreshSkew)) {
					dispatchEvent('tokenRefreshed', [
						{ idToken: stored.id_token, accessToken: stored.access_token, refreshToken: stored.refresh_token, claims: stored.claims },
					]);
					return;
				}
			}

			if (typeof flowState.session?.refresh_token !== 'string') {
				return;
			}

			try {
				const session = await refreshToken({ refreshToken: flowState.session.refresh_token, options, expectedSub: flowState.session?.claims?.sub });
				await updateSession(session);

				dispatchEvent('tokenRefreshed', [
					{
						idToken: flowState.session?.id_token,
						accessToken: flowState.session?.access_token,
						refreshToken: flowState.session?.refresh_token,
						claims: flowState.session?.claims,
					},
				]);
				options.logging?.debug('Session refresh successful');
			} catch (error) {
				const failedRefreshToken = flowState.session?.refresh_token;

				// NOTE: Transient Network/Server failures must not destroy a session that could still be refreshed later.
				if (!(error instanceof NetworkError) && !(error instanceof ServerError)) {
					await cleanupSession();
				}

				dispatchEvent('tokenRefreshFailed', [{ refreshToken: failedRefreshToken }]);
				options.logging?.error('Session refresh failed', error);

				throw error;
			}
		}).finally(() => {
			promises.refresh = null;
		});

		return promises.refresh;
	}

	async function revoke(): ReturnType<SDK<URIHandlerParams>['revoke']> {
		await init();

		if (promises.revoke) {
			return promises.revoke;
		}

		promises.revoke = (async () => {
			try {
				if (flowState.session?.refresh_token) {
					options.logging?.debug('Attempting to revoke refresh token');
				} else if (flowState.session?.access_token) {
					options.logging?.debug('Attempting to revoke access token');
				}

				// NOTE: Cleanup session before revocation
				const currentSession = await withSessionLock(async () => {
					const currentSession = (await loadStoredSession()) ?? flowState.session;
					await cleanupSession();

					return currentSession;
				});

				if (!currentSession?.access_token && !currentSession?.refresh_token) {
					options.logging?.debug('Revoke called without session');
					return;
				}

				const tokenTypeHint = currentSession.refresh_token ? 'refresh_token' : 'access_token';
				const token = (tokenTypeHint === 'refresh_token' ? currentSession.refresh_token : currentSession.access_token)!;

				try {
					await revokeToken({ tokenTypeHint, token, options });

					if (tokenTypeHint === 'refresh_token') {
						dispatchEvent('tokenRevoked', [{ token: currentSession.refresh_token, tokenTypeHint: 'refresh_token' }]);
						options.logging?.info('Refresh token successfully revoked');
					} else {
						dispatchEvent('tokenRevoked', [{ token: currentSession.access_token, tokenTypeHint: 'access_token' }]);
						options.logging?.info('Access token successfully revoked');
					}
				} catch (error) {
					if (tokenTypeHint === 'refresh_token') {
						dispatchEvent('tokenRevokeFailed', [{ token: currentSession.refresh_token, tokenTypeHint: 'refresh_token' }]);
					} else {
						dispatchEvent('tokenRevokeFailed', [{ token: currentSession.access_token, tokenTypeHint: 'access_token' }]);
					}

					options.logging?.error('Token revocation failed', error);
					throw error;
				}
			} finally {
				promises.revoke = null;
			}
		})();

		return promises.revoke;
	}

	async function logout(
		params?: Parameters<SDK<URIHandlerParams>['logout']>[0],
		uriHandlerOverride?: typeof options.uriHandler,
	): ReturnType<SDK<URIHandlerParams>['logout']> {
		await init();

		if (promises.logout) {
			return promises.logout;
		}

		promises.logout = (async () => {
			try {
				options.logging?.debug('Attempting to logout');

				// NOTE: Cleanup session before logout
				const currentSession = await withSessionLock(async () => {
					const currentSession = (await loadStoredSession()) ?? flowState.session;
					await cleanupSession();

					return currentSession;
				});

				dispatchEvent('logoutInitiated', [{ idToken: currentSession?.id_token, claims: currentSession?.claims }]);
				options.logging?.debug('Logout initiated');

				if (!currentSession?.id_token) {
					options.logging?.debug('Logout called without id token');
					return;
				}

				try {
					const metadata = await getDiscoveryDocument(options);
					const logoutUrl = buildEndSessionUrl({
						url: metadata.end_session_endpoint,
						idToken: currentSession.id_token,
						postLogoutRedirectUri: params?.postLogoutRedirectUri,
					});
					const uriHandler = uriHandlerOverride ?? options.uriHandler;

					await uriHandler(logoutUrl, params);
				} catch (error) {
					options.logging?.error('Unable to redirect to the end-session endpoint', error);
				}
			} finally {
				promises.logout = null;
			}
		})();

		return promises.logout;
	}

	return {
		dispatchEvent,
		subscribeToEvent,
		subscribeToAllEvents,
		getSession,
		updateSession,
		cleanupSession,
		checkAuthentication,
		init,
		tokenExchange,
		handleCallback,
		refresh,
		revoke,
		logout,
	};
}
