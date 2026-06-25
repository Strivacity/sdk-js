import type { EventFunctions, ExtraRequestArgs, FlowState, IdTokenClaims, SDK, SDKOptions, SessionData } from '../types/oidc';
import { buildEndSessionUrl, exchangeCode, refreshToken, revokeToken, decodeJwt } from '../utils/oidc';
import { loadSession, serializeSession, isSessionExpired } from '../utils/session';

export function createBaseFlow<URLHandlerParams extends ExtraRequestArgs = ExtraRequestArgs>(state: FlowState, options: SDKOptions) {
	let initPromise: Promise<void> | null = null;
	let refreshPromise: Promise<void> | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const eventCallbacks: Record<keyof EventFunctions, Set<(...args: Array<any>) => Promise<void> | void>> = {
		accessTokenExpired: new Set(),
		init: new Set(),
		loggedIn: new Set(),
		loginInitiated: new Set(),
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
	): { dispose: () => void } {
		eventCallbacks[eventName].add(callbackFn);
		return { dispose: () => eventCallbacks[eventName].delete(callbackFn) };
	}

	function subscribeToAllEvents(callbackFn: (...params: Array<unknown>) => Promise<void> | void): { dispose: () => void } {
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

	async function getSession(): Promise<SessionData | null> {
		await init();

		return state.session;
	}

	async function updateSession(newData: SessionData): Promise<void> {
		await init();

		if (newData.id_token) {
			newData.claims = decodeJwt<IdTokenClaims>(newData.id_token);
		}

		await options.storage.set(options.storageTokenName, serializeSession(newData));
		state.session = newData;
	}

	async function cleanupSession(): Promise<void> {
		await init();

		await options.storage.delete(options.storageTokenName);
		state.session = null;
	}

	async function checkAuthentication(params: { autoRefresh: boolean } = { autoRefresh: options.autoRefresh }): Promise<boolean> {
		if (!state.session?.access_token || !isSessionExpired(state.session)) {
			return !!state.session?.access_token;
		}

		if (params?.autoRefresh && state.session.refresh_token) {
			try {
				await refresh();
			} catch {
				return false;
			}
		}

		return !isSessionExpired(state.session);
	}

	async function getAccessToken(
		params: Parameters<SDK<URLHandlerParams>['getAccessToken']>[0] = { autoRefresh: options.autoRefresh },
	): ReturnType<SDK<URLHandlerParams>['getAccessToken']> {
		await init();

		if (!state.session?.access_token) {
			return null;
		}

		if (params?.autoRefresh && state.session?.refresh_token && isSessionExpired(state.session)) {
			await refresh();
		}

		return state.session?.access_token ?? null;
	}

	async function init(): ReturnType<SDK<URLHandlerParams>['init']> {
		if (state.initialized) {
			return;
		}

		if (initPromise) {
			return initPromise;
		}

		initPromise = (async () => {
			try {
				if (!options.issuer) {
					const error = new Error('Missing option: issuer');
					options.logging?.error('Required option missing', error);
					throw error;
				}
				if (!options.clientId) {
					const error = new Error('Missing option: clientId');
					options.logging?.error('Required option missing', error);
					throw error;
				}
				if (!options.redirectUri) {
					const error = new Error('Missing option: redirectUri');
					options.logging?.error('Required option missing', error);
					throw error;
				}
				if (options.scopes && !Array.isArray(options.scopes)) {
					const error = new Error('Invalid option: scopes');
					options.logging?.error('Invalid option provided', error);
					throw error;
				}

				state.session = loadSession(await options.storage.get(options.storageTokenName));
				state.initialized = true;

				dispatchEvent('init', []);
				options.logging?.debug('SDK initialized');

				if (!state.session) {
					options.logging?.debug('No session found in storage');
				}

				if (state.session?.access_token) {
					dispatchEvent('sessionLoaded', [
						{ accessToken: state.session.access_token, refreshToken: state.session.refresh_token, claims: state.session.claims },
					]);
					options.logging?.debug('Session loaded from storage');
				}

				if (state.session?.access_token && isSessionExpired(state.session)) {
					dispatchEvent('accessTokenExpired', [{ accessToken: state.session.access_token, refreshToken: state.session.refresh_token }]);
					options.logging?.debug('Access token has expired');
				}
			} finally {
				initPromise = null;
			}
		})();

		return initPromise;
	}

	async function tokenExchange(params: Parameters<SDK<URLHandlerParams>['tokenExchange']>[0] = {}): ReturnType<SDK<URLHandlerParams>['tokenExchange']> {
		await init();

		options.logging?.debug('Exchanging authorization code for tokens');

		try {
			const session = await exchangeCode({ params, options });
			await updateSession(session);

			options.logging?.debug('Token exchange successful');

			if (session.access_token) {
				dispatchEvent('loggedIn', [{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims }]);

				if (options.logging) {
					options.logging.xEventId = undefined;
					options.logging.info('Login successful');
				}
			}
		} catch (error) {
			options.logging?.error('Token exchange failed', error);
			throw error;
		}
	}

	async function handleCallback(url?: string | URL): Promise<void> {
		await init();

		const callbackUrl = url ?? globalThis.window?.location.href;
		const params = (await options.callbackHandler(callbackUrl, options.responseMode)) as Record<string, string>;

		await tokenExchange(params);
	}

	async function refresh(): ReturnType<SDK<URLHandlerParams>['refresh']> {
		await init();

		if (refreshPromise) {
			return refreshPromise;
		}

		options.logging?.debug('Attempting to refresh session');

		if (typeof state.session?.refresh_token !== 'string') {
			options.logging?.debug('Refresh called without refresh token');
			return;
		}

		refreshPromise = (async () => {
			try {
				const session = await refreshToken({ refreshToken: state.session!.refresh_token!, options });
				await updateSession(session);

				dispatchEvent('tokenRefreshed', [
					{ accessToken: state.session?.access_token, refreshToken: state.session?.refresh_token, claims: state.session?.claims },
				]);
				options.logging?.debug('Session refresh successful');
			} catch (error) {
				const failedRefreshToken = state.session?.refresh_token;
				await cleanupSession();
				dispatchEvent('tokenRefreshFailed', [{ refreshToken: failedRefreshToken }]);
				options.logging?.error('Session refresh failed', error);

				throw error;
			} finally {
				refreshPromise = null;
			}
		})();

		return refreshPromise;
	}

	async function revoke(): ReturnType<SDK<URLHandlerParams>['revoke']> {
		await init();

		if (state.session?.refresh_token) {
			options.logging?.debug('Attempting to revoke refresh token');
		} else if (state.session?.access_token) {
			options.logging?.debug('Attempting to revoke access token');
		}

		// NOTE: Cleanup session before revocation
		const currentSession = state.session;
		await cleanupSession();

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
	}

	async function logout(params?: Parameters<SDK<URLHandlerParams>['logout']>[0]): ReturnType<SDK<URLHandlerParams>['logout']> {
		await init();

		options.logging?.debug('Attempting to logout');

		// NOTE: Cleanup session before logout
		const currentSession = state.session;
		await cleanupSession();

		dispatchEvent('logoutInitiated', [{ idToken: currentSession?.id_token, claims: currentSession?.claims }]);
		options.logging?.debug('Logout initiated');

		if (!currentSession?.id_token) {
			options.logging?.debug('Logout called without session');
			return;
		}

		const logoutUrl = buildEndSessionUrl({
			url: (await options.getMetadata()).end_session_endpoint,
			idToken: currentSession.id_token!,
			postLogoutRedirectUri: params?.postLogoutRedirectUri,
		});

		await options.urlHandler(logoutUrl, params);
	}

	return {
		dispatchEvent,
		subscribeToEvent,
		subscribeToAllEvents,
		getSession,
		updateSession,
		cleanupSession,
		checkAuthentication,
		getAccessToken,
		init,
		tokenExchange,
		handleCallback,
		refresh,
		revoke,
		logout,
	};
}
