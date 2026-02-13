import { type MockInstance, vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { type Storage, mockLocalStorage, mockSessionStorage } from '@strivacity/testing/mocks/storages';
import { type SDKOptions, type NativeParams, type IdTokenClaims, initFlow } from '../../src';
import type { NativeFlow } from '../../src/flows/NativeFlow';
import { jwt } from '../../src/utils/jwt';
import { redirectUrlHandler, redirectCallbackHandler } from '../../src/utils/handlers';
import { LocalStorage } from '../../src/storages/LocalStorage';
import { SessionStorage } from '../../src/storages/SessionStorage';
import { DefaultLogging } from '../../src/utils/Logging';
import { HttpClient } from '../../src/utils/HttpClient';

class CustomHttpClient extends HttpClient {}

describe('NativeFlow', () => {
	const options: SDKOptions = {
		mode: 'native',
		issuer: 'https://brandtegrity.io',
		scopes: ['openid', 'profile'],
		clientId: '2202c596c06e4774b42804af00c66df9',
		redirectUri: 'https://brandtegrity.io/app/callback/',
		responseType: 'code',
		responseMode: 'query',
		logging: DefaultLogging,
	};
	const spyInitFlow = (options: SDKOptions, spyOptions?: Partial<{ mockLoginRequests: boolean }>) => {
		const flow = initFlow(options) as NativeFlow;
		const spies: Record<string, MockInstance> = {
			httpClient: vi.spyOn(flow.httpClient, 'request'),
			tokenExchange: vi.spyOn(flow, 'tokenExchange'),
			fetchMetadata: vi.spyOn(flow.metadata, 'fetchMetadata'),
			// @ts-expect-error: Protected function
			dispatchEvent: vi.spyOn(flow, 'dispatchEvent'),
			waitToInitialize: vi.spyOn(flow, 'waitToInitialize'),
			// @ts-expect-error: Protected function
			sendTokenRequest: vi.spyOn<unknown>(flow, 'sendTokenRequest'),
		};
		const loggingSpy = {
			debug: vi.spyOn(flow.logging!, 'debug'),
			info: vi.spyOn(flow.logging!, 'info'),
			warn: vi.spyOn(flow.logging!, 'warn'),
			error: vi.spyOn(flow.logging!, 'error'),
			get xEventId() {
				return flow.logging!.xEventId;
			},
		};

		if (typeof options.urlHandler === 'function') {
			spies.urlHandler = vi.spyOn(flow.options, 'urlHandler').mockImplementation(() => Promise.resolve());
		}

		if (spyOptions?.mockLoginRequests) {
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ authorization_endpoint: `${options.issuer}/oauth2/auth` }),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(`${options.redirectUri}?session_id=sessionId`),
			});
			spies.httpClient.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ forms: [] }),
			});
		}

		return { flow, spies, loggingSpy };
	};
	let storage: Storage = mockLocalStorage();

	describe('initFlow', () => {
		beforeEach(() => {
			storage = mockLocalStorage();
		});

		test('should throw error w/o required params', () => {
			// @ts-expect-error: Missing options
			expect(() => initFlow({ mode: 'native' })).toThrowError('Missing option: issuer');
			// @ts-expect-error: Missing options
			expect(() => initFlow({ mode: 'native', issuer: options.issuer })).toThrowError('Missing option: clientId');
			// @ts-expect-error: Missing options
			expect(() => initFlow({ mode: 'native', issuer: options.issuer, clientId: options.clientId })).toThrowError('Missing option: redirectUri');
			// @ts-expect-error: Invalid option
			expect(() => initFlow({ ...options, scopes: 'invalid' })).toThrowError('Invalid option: scopes');
			expect(() => initFlow({ mode: 'native', issuer: options.issuer, clientId: options.clientId, redirectUri: options.redirectUri })).not.toThrowError();
		});

		test('should set non-required params correctly', () => {
			let flow = initFlow({ issuer: options.issuer, clientId: options.clientId, redirectUri: options.redirectUri });

			expect(flow.options.scopes).toEqual(['openid']);
			expect(flow.options.responseType).toEqual('code');
			expect(flow.options.responseMode).toEqual('query');
			expect(flow.options.storageTokenName).toEqual('sty.session');
			expect(flow.options.urlHandler).toBe(redirectUrlHandler);
			expect(flow.options.callbackHandler).toBe(redirectCallbackHandler);
			expect(flow.storage).toBeInstanceOf(LocalStorage);
			expect(flow.httpClient).toBeInstanceOf(HttpClient);
			expect(flow.logging).toBeUndefined();

			flow = initFlow({
				...options,
				scopes: ['custom', 'scope'],
				responseType: 'id_token',
				responseMode: 'fragment',
				storageTokenName: 'custom',
				storage: SessionStorage,
				httpClient: CustomHttpClient,
				logging: DefaultLogging,
				urlHandler: () => Promise.resolve(),
				callbackHandler: () => Promise.resolve(),
			});

			expect(flow.options.scopes).toEqual(['custom', 'scope']);
			expect(flow.options.responseType).toEqual('id_token');
			expect(flow.options.responseMode).toEqual('fragment');
			expect(flow.options.storageTokenName).toEqual('custom');
			expect(flow.options.urlHandler).not.toBe(redirectUrlHandler);
			expect(flow.options.callbackHandler).not.toBe(redirectCallbackHandler);
			expect(flow.storage).toBeInstanceOf(SessionStorage);
			expect(flow.httpClient).toBeInstanceOf(CustomHttpClient);
			expect(flow.logging).toBeInstanceOf(DefaultLogging);
		});

		describe('should dispatch constructor events correctly', () => {
			beforeEach(() => {
				vi.useFakeTimers();
			});

			afterEach(() => {
				vi.useRealTimers();
			});

			test('init', async () => {
				const { spies } = spyInitFlow(options);

				vi.advanceTimersByTime(1);

				await vi.waitFor(() => expect(spies.dispatchEvent).toHaveBeenCalledWith('init', []));
			});

			test('sessionLoaded', async () => {
				const session = storage.generateSession();
				const { spies } = spyInitFlow(options);

				vi.advanceTimersByTime(1);

				await vi.waitFor(() =>
					expect(spies.dispatchEvent).toHaveBeenCalledWith('sessionLoaded', [
						{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
					]),
				);
			});

			test('accessTokenExpired', async () => {
				const session = storage.generateSession({ expires_at: 0 });
				const { spies } = spyInitFlow(options);

				vi.advanceTimersByTime(1);

				await vi.waitFor(() =>
					expect(spies.dispatchEvent).toHaveBeenCalledWith('sessionLoaded', [
						{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
					]),
				);
				await vi.waitFor(() =>
					expect(spies.dispatchEvent).toHaveBeenCalledWith('accessTokenExpired', [{ accessToken: session.access_token, refreshToken: session.refresh_token }]),
				);
			});
		});

		test('should use another storage correctly', async () => {
			storage = mockSessionStorage();

			const { flow } = spyInitFlow({ ...options, storage: SessionStorage }, { mockLoginRequests: true });

			await flow.login().startSession();
			const state = storage.getLastState();

			await vi.waitFor(() => expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state)));
		});
	});

	describe('getters', () => {
		describe('isAuthenticated', () => {
			test('should send back the same promise', async () => {
				const { flow } = spyInitFlow(options);
				const promise1 = await flow.isAuthenticated;
				const promise2 = await flow.isAuthenticated;

				expect(promise1).toEqual(promise2);
			});
		});

		describe('isAuthenticatedSync', () => {
			test('should return false without session', () => {
				const { flow } = spyInitFlow(options);

				expect(flow.isAuthenticatedSync).toEqual(false);
			});

			test('should return false with session but without access token', () => {
				const session = storage.generateSession();
				const { flow } = spyInitFlow(options);

				flow.session = { ...session, access_token: null, expires_in: 0 };

				expect(flow.isAuthenticatedSync).toEqual(false);
			});

			test('should return false with expired access token', () => {
				const session = storage.generateSession({ expires_at: 0 });
				const { flow } = spyInitFlow(options);

				flow.session = session;

				expect(flow.isAuthenticatedSync).toEqual(false);
			});

			test('should return true with valid access token', () => {
				const session = storage.generateSession();
				const { flow } = spyInitFlow(options);

				flow.session = session;

				expect(flow.isAuthenticatedSync).toEqual(true);
			});
		});
	});

	describe('functions', () => {
		beforeEach(() => {
			storage = mockLocalStorage();
		});

		describe('login', () => {
			test('should return NativeFlowHandler', async () => {
				const { flow, spies } = spyInitFlow(options, { mockLoginRequests: true });

				await flow.login().startSession();
				const state = storage.getLastState();
				const url = new URL(spies.httpClient.mock.calls[1][0]);

				expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(0);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
				expect(url.origin).toEqual(options.issuer);
				expect(url.pathname).toEqual('/oauth2/auth');
				expect(url.searchParams.get('client_id')).toEqual(options.clientId);
				expect(url.searchParams.get('redirect_uri')).toEqual(options.redirectUri);
				expect(url.searchParams.get('response_type')).toEqual(options.responseType);
				expect(url.searchParams.get('response_mode')).toEqual(options.responseMode);
				expect(url.searchParams.get('scope')).toEqual(options.scopes?.join(' '));
				expect(url.searchParams.get('code_challenge_method')).toEqual('S256');
				expect(url.searchParams.get('state')).toEqual(state?.id);
				expect(url.searchParams.get('code_challenge')).toEqual(state?.codeChallenge);
				expect(url.searchParams.get('nonce')).toEqual(state?.nonce);
				expect(spies.httpClient).toHaveBeenCalledTimes(3);
			});

			test('should return NativeFlowHandler w/ extra params', async () => {
				const { flow, spies } = spyInitFlow(options, { mockLoginRequests: true });
				const extraParams: NativeParams = {
					prompt: 'login',
					loginHint: 'hint',
					acrValues: ['acr', 'value'],
					uiLocales: ['hu-HU', 'en-US'],
					audiences: ['https://api.example.com', 'https://service.example.com'],
				};

				await flow.login(extraParams).startSession();
				const state = storage.getLastState();
				const url = new URL(spies.httpClient.mock.calls[1][0]);

				expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(0);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
				expect(url.origin).toEqual(options.issuer);
				expect(url.pathname).toEqual('/oauth2/auth');
				expect(url.searchParams.get('client_id')).toEqual(options.clientId);
				expect(url.searchParams.get('redirect_uri')).toEqual(options.redirectUri);
				expect(url.searchParams.get('response_type')).toEqual(options.responseType);
				expect(url.searchParams.get('response_mode')).toEqual(options.responseMode);
				expect(url.searchParams.get('scope')).toEqual(options.scopes?.join(' '));
				expect(url.searchParams.get('code_challenge_method')).toEqual('S256');
				expect(url.searchParams.get('state')).toEqual(state?.id);
				expect(url.searchParams.get('code_challenge')).toEqual(state?.codeChallenge);
				expect(url.searchParams.get('nonce')).toEqual(state?.nonce);
				expect(url.searchParams.get('prompt')).toEqual(extraParams?.prompt);
				expect(url.searchParams.get('login_hint')).toEqual(extraParams?.loginHint);
				expect(url.searchParams.get('acr_values')).toEqual(extraParams?.acrValues?.join(' '));
				expect(url.searchParams.get('ui_locales')).toEqual(extraParams?.uiLocales?.join(' '));
				expect(url.searchParams.get('audience')).toEqual(extraParams?.audiences?.join(' '));
				expect(spies.httpClient).toHaveBeenCalledTimes(3);
			});
		});

		describe('register', () => {
			test('should return NativeFlowHandler', async () => {
				const { flow, spies } = spyInitFlow(options, { mockLoginRequests: true });

				await flow.register().startSession();
				const state = storage.getLastState();
				const url = new URL(spies.httpClient.mock.calls[1][0]);

				expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(0);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
				expect(url.origin).toEqual(options.issuer);
				expect(url.pathname).toEqual('/oauth2/auth');
				expect(url.searchParams.get('client_id')).toEqual(options.clientId);
				expect(url.searchParams.get('redirect_uri')).toEqual(options.redirectUri);
				expect(url.searchParams.get('response_type')).toEqual(options.responseType);
				expect(url.searchParams.get('response_mode')).toEqual(options.responseMode);
				expect(url.searchParams.get('scope')).toEqual(options.scopes?.join(' '));
				expect(url.searchParams.get('code_challenge_method')).toEqual('S256');
				expect(url.searchParams.get('state')).toEqual(state?.id);
				expect(url.searchParams.get('code_challenge')).toEqual(state?.codeChallenge);
				expect(url.searchParams.get('nonce')).toEqual(state?.nonce);
				expect(url.searchParams.get('prompt')).toEqual('create');
			});

			test('should return NativeFlowHandler w/ extra params', async () => {
				const { flow, spies } = spyInitFlow(options, { mockLoginRequests: true });
				const extraParams: NativeParams = {
					loginHint: 'hint',
					acrValues: ['acr', 'value'],
					uiLocales: ['hu-HU', 'en-US'],
					audiences: ['https://api.example.com', 'https://service.example.com'],
				};

				await flow.register(extraParams).startSession();
				const state = storage.getLastState();
				const url = new URL(spies.httpClient.mock.calls[1][0]);

				expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(0);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
				expect(url.origin).toEqual(options.issuer);
				expect(url.pathname).toEqual('/oauth2/auth');
				expect(url.searchParams.get('client_id')).toEqual(options.clientId);
				expect(url.searchParams.get('redirect_uri')).toEqual(options.redirectUri);
				expect(url.searchParams.get('response_type')).toEqual(options.responseType);
				expect(url.searchParams.get('response_mode')).toEqual(options.responseMode);
				expect(url.searchParams.get('scope')).toEqual(options.scopes?.join(' '));
				expect(url.searchParams.get('code_challenge_method')).toEqual('S256');
				expect(url.searchParams.get('state')).toEqual(state?.id);
				expect(url.searchParams.get('code_challenge')).toEqual(state?.codeChallenge);
				expect(url.searchParams.get('nonce')).toEqual(state?.nonce);
				expect(url.searchParams.get('prompt')).toEqual('create');
				expect(url.searchParams.get('login_hint')).toEqual(extraParams?.loginHint);
				expect(url.searchParams.get('acr_values')).toEqual(extraParams?.acrValues?.join(' '));
				expect(url.searchParams.get('ui_locales')).toEqual(extraParams?.uiLocales?.join(' '));
				expect(url.searchParams.get('audience')).toEqual(extraParams?.audiences?.join(' '));
				expect(spies.httpClient).toHaveBeenCalledTimes(3);
			});
		});

		describe('logout', () => {
			test('should do nothing w/o idToken', async () => {
				const { flow, spies } = spyInitFlow(options);

				await flow.logout();

				expect(storage.spies.delete).not.toHaveBeenCalled();
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(1);
				expect(spies.dispatchEvent).not.toHaveBeenCalledWith('logoutInitiated', expect.anything());
				expect(spies.urlHandler).not.toHaveBeenCalled();
			});

			test('should logout correctly w/o postLogoutRedirectUri', async () => {
				const session = storage.generateSession();
				const { flow, spies, loggingSpy } = spyInitFlow(options);

				expect(await flow.isAuthenticated).toEqual(true);
				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(flow.idTokenClaims).toEqual(session.claims);

				await flow.logout();

				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(2);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('logoutInitiated', [{ idToken: session.id_token, claims: session.claims }]);
				expect(loggingSpy.debug).toHaveBeenCalledWith('Attempting to logout');
				expect(spies.urlHandler).toHaveBeenCalledOnce();

				const url = new URL(spies.urlHandler.mock.calls[0][0]);

				expect(url.origin).toEqual(options.issuer);
				expect(url.pathname).toEqual('/oauth2/sessions/logout');
				expect(url.searchParams.get('id_token_hint')).toEqual(session.id_token);
				expect(url.searchParams.has('post_logout_redirect_uri')).toBeFalsy();
			});

			test('should logout correctly w/ postLogoutRedirectUri', async () => {
				const session = storage.generateSession();
				const { flow, spies } = spyInitFlow(options);

				expect(await flow.isAuthenticated).toEqual(true);
				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(flow.idTokenClaims).toEqual(session.claims);

				await flow.logout({ postLogoutRedirectUri: 'https://brandtegrity.io/app/logout' });

				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(2);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('logoutInitiated', [{ idToken: session.id_token, claims: session.claims }]);
				expect(spies.urlHandler).toHaveBeenCalledOnce();

				const url = new URL(spies.urlHandler.mock.calls[0][0]);

				expect(url.origin).toEqual(options.issuer);
				expect(url.pathname).toEqual('/oauth2/sessions/logout');
				expect(url.searchParams.get('id_token_hint')).toEqual(session.id_token);
				expect(url.searchParams.get('post_logout_redirect_uri')).toEqual('https://brandtegrity.io/app/logout');
			});

			test('should throw error w/o urlHandler', async () => {
				// @ts-expect-error: Invalid options
				const { flow, loggingSpy } = spyInitFlow({ ...options, urlHandler: 'invalid' });

				await expect(() => flow.logout()).rejects.toThrowError('Missing option: urlHandler');
				expect(loggingSpy.error).toHaveBeenCalledWith('Required option missing', expect.any(Error));
			});
		});

		describe('refresh', () => {
			test('should refresh correctly', async () => {
				const session = storage.generateSession({ expires_at: 0 });
				const refreshedSession = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => refreshedSession }));

				await vi.waitFor(() => expect(flow.session).not.toBeNull());

				// NOTE: We can't test isAuthenticated here, because that will trigger the refresh function
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);

				await flow.refresh();

				expect(spies.sendTokenRequest).toHaveBeenCalledWith(`${options.issuer}/oauth2/token`, {
					grant_type: 'refresh_token',
					client_id: options.clientId,
					refresh_token: session.refresh_token,
				});
				expect(storage.spies.set).toHaveBeenCalledWith('sty.session', JSON.stringify(refreshedSession));
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRefreshed', [
					{ accessToken: refreshedSession.access_token, refreshToken: refreshedSession.refresh_token, claims: refreshedSession.claims },
				]);
				expect(await flow.isAuthenticated).toEqual(true);
				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(refreshedSession.expires_at);
				expect(flow.accessToken).toEqual(refreshedSession.access_token);
				expect(flow.refreshToken).toEqual(refreshedSession.refresh_token);
			});

			test('should refresh correctly w/ isAuthenticated', async () => {
				const session = storage.generateSession({ expires_at: 0 });
				const refreshedSession = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				spies.refresh = vi.spyOn(flow, 'refresh');
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => refreshedSession }));

				await vi.waitFor(() => expect(flow.session).not.toBeNull());

				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(await flow.isAuthenticated).toEqual(true);

				expect(spies.refresh).toHaveBeenCalled();
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(2);

				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(refreshedSession.expires_at);
				expect(flow.accessToken).toEqual(refreshedSession.access_token);
				expect(flow.refreshToken).toEqual(refreshedSession.refresh_token);
				expect(await flow.isAuthenticated).toEqual(true);
			});

			test('should not throw an error w/o refresh token', async () => {
				const { flow, spies } = spyInitFlow(options);

				expect(await flow.isAuthenticated).toEqual(false);

				await flow.refresh();

				expect(spies.sendTokenRequest).not.toHaveBeenCalled();
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(2);
				expect(spies.dispatchEvent).not.toHaveBeenCalledWith('tokenRefreshed', expect.anything());
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
			});

			test('should not throw an error w/ invalid refresh token', async () => {
				const session = storage.generateSession({ expires_at: 0 });
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.reject());
				storage.spies.set.mockClear();

				await vi.waitFor(() => expect(flow.session).not.toBeNull());

				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);

				await flow.refresh();

				expect(spies.sendTokenRequest).toHaveBeenCalledWith(`${options.issuer}/oauth2/token`, {
					grant_type: 'refresh_token',
					client_id: options.clientId,
					refresh_token: session.refresh_token,
				});
				expect(storage.spies.set).not.toBeCalled();
				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.dispatchEvent).not.toHaveBeenCalledWith('tokenRefreshed', expect.anything());
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRefreshFailed', [{ refreshToken: session.refresh_token }]);
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
			});

			test('should handle error when refresh response is not ok', async () => {
				const session = storage.generateSession({ expires_at: 0 });
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() =>
					Promise.resolve({ ok: false, json: () => ({ error: 'invalid_grant', error_description: 'Token expired' }) }),
				);
				storage.spies.set.mockClear();

				await vi.waitFor(() => expect(flow.session).not.toBeNull());

				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);

				await flow.refresh();

				expect(spies.sendTokenRequest).toHaveBeenCalledWith(`${options.issuer}/oauth2/token`, {
					grant_type: 'refresh_token',
					client_id: options.clientId,
					refresh_token: session.refresh_token,
				});
				expect(storage.spies.set).not.toBeCalled();
				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRefreshFailed', [{ refreshToken: session.refresh_token }]);
				expect(flow.session).toBeNull();
			});
		});

		describe('revoke', () => {
			test('should do nothing w/o access and refresh token', async () => {
				const { flow, spies } = spyInitFlow(options);

				await flow.revoke();

				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(1);
				expect(spies.dispatchEvent).not.toHaveBeenCalledWith('tokenRevoked', expect.anything());
				expect(spies.urlHandler).not.toHaveBeenCalled();
			});

			test('should revoke correctly w/ refresh token', async () => {
				const session = storage.generateSession();
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve());

				expect(await flow.isAuthenticated).toEqual(true);
				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(flow.idTokenClaims).toEqual(session.claims);

				await flow.revoke();

				expect(spies.sendTokenRequest).toHaveBeenCalledWith(`${options.issuer}/oauth2/revoke`, {
					token_type_hint: 'refresh_token',
					token: session.refresh_token,
					client_id: options.clientId,
				});
				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(2);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRevoked', [{ tokenTypeHint: 'refresh_token', token: session.refresh_token }]);
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
				expect(flow.idTokenClaims).toEqual(undefined);
			});

			test('should revoke correctly w/ access token', async () => {
				const session = storage.generateSession({ refresh_token: null });
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve());

				expect(await flow.isAuthenticated).toEqual(true);
				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(flow.idTokenClaims).toEqual(session.claims);

				await flow.revoke();

				expect(spies.sendTokenRequest).toHaveBeenCalledWith(`${options.issuer}/oauth2/revoke`, {
					token_type_hint: 'access_token',
					token: session.access_token,
					client_id: options.clientId,
				});
				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.waitToInitialize).toHaveBeenCalledTimes(2);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRevoked', [{ tokenTypeHint: 'access_token', token: session.access_token }]);
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
				expect(flow.idTokenClaims).toEqual(undefined);
			});

			test('should not throw an error w/ invalid refresh token', async () => {
				const session = storage.generateSession();
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.reject());

				expect(await flow.isAuthenticated).toEqual(true);
				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(flow.idTokenClaims).toEqual(session.claims);

				await flow.revoke();

				expect(spies.sendTokenRequest).toHaveBeenCalledWith(`${options.issuer}/oauth2/revoke`, {
					token_type_hint: 'refresh_token',
					token: session.refresh_token,
					client_id: options.clientId,
				});
				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRevokeFailed', [{ tokenTypeHint: 'refresh_token', token: session.refresh_token }]);
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
				expect(flow.idTokenClaims).toEqual(undefined);
			});

			test('should not throw an error w/ invalid access token', async () => {
				const session = storage.generateSession({ refresh_token: null });
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.reject());

				expect(await flow.isAuthenticated).toEqual(true);
				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(flow.idTokenClaims).toEqual(session.claims);

				await flow.revoke();

				expect(spies.sendTokenRequest).toHaveBeenCalledWith(`${options.issuer}/oauth2/revoke`, {
					token_type_hint: 'access_token',
					token: session.access_token,
					client_id: options.clientId,
				});
				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRevokeFailed', [{ tokenTypeHint: 'access_token', token: session.access_token }]);
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
				expect(flow.idTokenClaims).toEqual(undefined);
			});

			test('should handle error when revoke response is not ok', async () => {
				const session = storage.generateSession();
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() =>
					Promise.resolve({ ok: false, json: () => ({ error: 'invalid_token', error_description: 'Token is invalid' }) }),
				);

				expect(await flow.isAuthenticated).toEqual(true);

				await flow.revoke();

				expect(spies.sendTokenRequest).toHaveBeenCalledWith(`${options.issuer}/oauth2/revoke`, {
					token_type_hint: 'refresh_token',
					token: session.refresh_token,
					client_id: options.clientId,
				});
				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRevokeFailed', [{ token: session.refresh_token, tokenTypeHint: 'refresh_token' }]);
				expect(flow.session).toBeNull();
			});
		});

		describe('entry', () => {
			test('should get back session_id correctly', async () => {
				const { flow } = spyInitFlow({ ...options });

				flow.httpClient.request = vi.fn().mockResolvedValue({
					ok: true,
					status: 200,
					text: () => Promise.resolve('https://brandtegrity.io/entry?session_id=abcd1234'),
				});

				const sessionId = await flow.entry('http://localhost:4200/entry');

				expect(flow.httpClient.request).toHaveBeenCalledWith(
					`${flow.options.issuer}/provider/flow/entry?sdk=web&client_id=${flow.options.clientId}&redirect_uri=${encodeURIComponent(flow.options.redirectUri)}`,
				);
				expect(sessionId).toEqual('abcd1234');
			});

			test('should get back session_id from response.url when text() throws', async () => {
				const { flow } = spyInitFlow({ ...options });

				flow.httpClient.request = vi.fn().mockResolvedValue({
					ok: true,
					status: 200,
					url: 'https://brandtegrity.io/entry?session_id=xyz789',
					text: () => Promise.reject(new Error('Invalid text')),
				});

				const sessionId = await flow.entry('http://localhost:4200/entry');

				expect(sessionId).toEqual('xyz789');
			});

			test('should throw error on failed request with status 400 and error object', async () => {
				const { flow } = spyInitFlow({ ...options });

				flow.httpClient.request = vi.fn().mockResolvedValue({
					ok: false,
					status: 400,
					text: () => Promise.resolve(''),
					json: () => Promise.resolve({ error: 'invalid_request', error_description: 'description' }),
				});

				await expect(() => flow.entry('http://localhost:4200/entry')).rejects.toThrowError('invalid_request: description');
			});

			test('should throw error on failed request with status 400 and errorKey', async () => {
				const { flow } = spyInitFlow({ ...options });

				flow.httpClient.request = vi.fn().mockResolvedValue({
					ok: false,
					status: 400,
					text: () => Promise.resolve(''),
					json: () => Promise.resolve({ errorKey: 'custom_error_key' }),
				});

				await expect(() => flow.entry('http://localhost:4200/entry')).rejects.toThrowError('custom_error_key');
			});

			test('should throw error on failed request with status 400 and no specific error', async () => {
				const { flow } = spyInitFlow({ ...options });

				flow.httpClient.request = vi.fn().mockResolvedValue({
					ok: false,
					status: 400,
					text: () => Promise.resolve(''),
					json: () => Promise.resolve({}),
				});

				await expect(() => flow.entry('http://localhost:4200/entry')).rejects.toThrowError('Entry request failed with status 400');
			});

			test('should throw error on failed request with non-400 status', async () => {
				const { flow } = spyInitFlow({ ...options });

				flow.httpClient.request = vi.fn().mockResolvedValue({
					ok: false,
					status: 500,
					text: () => Promise.resolve(''),
				});

				await expect(() => flow.entry('http://localhost:4200/entry')).rejects.toThrowError('Entry request failed with status 500');
			});

			test('should throw error on missing session_id', async () => {
				const { flow } = spyInitFlow({ ...options });

				flow.httpClient.request = vi.fn().mockResolvedValue({
					ok: true,
					status: 200,
					text: () => Promise.resolve('https://brandtegrity.io/entry'),
				});

				await expect(() => flow.entry('http://localhost:4200/entry')).rejects.toThrowError('Session ID not found in entry response');
			});
		});

		describe('handleCallback', () => {
			test('should handle correctly', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({ state: JSON.stringify(state) }, null);
				const { flow, spies } = spyInitFlow(options);

				session.claims = { ...(session.claims as IdTokenClaims), nonce: state.nonce, aud: [options.clientId] };
				session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state.nonce, aud: [options.clientId] });
				storage.spies.set.mockClear();
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => session }));

				const url = new URL(options.redirectUri);
				url.searchParams.append('code', 'code');
				url.searchParams.append('state', state.id);

				await flow.handleCallback(url.toString());

				expect(storage.spies.delete).toHaveBeenCalledWith(`sty.${state.id}`);
				expect(storage.spies.set).toHaveBeenCalledWith('sty.session', JSON.stringify(session));
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loggedIn', [
					{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
				]);
			});

			test('should throw error w/o callbackHandler', async () => {
				// @ts-expect-error: Invalid options
				const { flow, loggingSpy } = spyInitFlow({ ...options, callbackHandler: 'invalid' });

				await expect(() => flow.handleCallback('https://brandtegrity.io/app/callback/?code=code&state=state')).rejects.toThrowError(
					'Missing option: callbackHandler',
				);
				expect(loggingSpy.error).toHaveBeenCalledWith('Required option missing', expect.any(Error));
			});
		});

		describe('tokenExchange', () => {
			test('should process correctly', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({ state: JSON.stringify(state) }, null);
				const { flow, spies } = spyInitFlow(options);

				session.claims = { ...(session.claims as IdTokenClaims), nonce: state.nonce, aud: [options.clientId] };
				session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state.nonce, aud: [options.clientId] });
				storage.spies.set.mockClear();
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => session }));

				await flow.tokenExchange({ code: 'code', state: state.id });

				expect(spies.waitToInitialize).toHaveBeenCalledTimes(1);
				expect(storage.spies.delete).toHaveBeenCalledWith(`sty.${state.id}`);
				expect(storage.spies.set).toHaveBeenCalledWith('sty.session', JSON.stringify(session));
			});

			test('should throw error on OIDC error', async () => {
				await storage.generateState();
				const { flow } = spyInitFlow(options);

				await expect(() => flow.tokenExchange({ error: 'invalid_request', error_description: 'text' })).rejects.toThrowError('invalid_request: text');
			});

			test('should throw error on missing code', async () => {
				const state = await storage.generateState();
				const { flow } = spyInitFlow(options);

				await expect(() => flow.tokenExchange({ state: state.id })).rejects.toThrowError('Invalid or missing code');
			});

			test('should throw error on invalid state', async () => {
				await storage.generateState();
				const { flow } = spyInitFlow(options);

				await expect(() => flow.tokenExchange({ code: 'code' })).rejects.toThrowError('Invalid or missing state');
			});

			test('should throw error on invalid id_token', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({ id_token: 'invalid' }, null);
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => session }));

				await expect(() => flow.tokenExchange({ code: 'code', state: state.id })).rejects.toThrowError('Invalid JWT');
			});

			test('should throw error on invalid scope', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({ scope: 'invalid' }, null);
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => session }));

				await expect(() => flow.tokenExchange({ code: 'code', state: state.id })).rejects.toThrowError('Invalid scope');
			});

			test('should throw error on invalid nonce', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => session }));

				await expect(() => flow.tokenExchange({ code: 'code', state: state.id })).rejects.toThrowError('Invalid nonce');
			});

			test('should throw error on invalid iss', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state.nonce, iss: 'invalid' });
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => session }));

				await expect(() => flow.tokenExchange({ code: 'code', state: state.id })).rejects.toThrowError('Invalid iss');
			});

			test('should throw error on invalid aud', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state.nonce, aud: ['invalid'] });
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => session }));

				await expect(() => flow.tokenExchange({ code: 'code', state: state.id })).rejects.toThrowError('Invalid aud');
			});

			test('should throw error when token exchange response is not ok', async () => {
				const state = await storage.generateState();
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() =>
					Promise.resolve({ ok: false, json: () => ({ error: 'invalid_grant', error_description: 'Authorization code is invalid' }) }),
				);

				await expect(() => flow.tokenExchange({ code: 'code', state: state.id })).rejects.toThrowError('invalid_grant: Authorization code is invalid');
			});

			test('should throw error when response contains error after token exchange', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				session.error = 'invalid_token';
				session.error_description = 'Token validation failed';
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ ok: true, json: () => session }));

				await expect(() => flow.tokenExchange({ code: 'code', state: state.id })).rejects.toThrowError('invalid_token: Token validation failed');
			});
		});

		describe('subscribeToEvent', () => {
			test('should return w/ disposable', () => {
				const { flow } = spyInitFlow(options);
				const event = flow.subscribeToEvent('init', () => undefined);

				expect(event.dispose).toBeDefined();
			});
		});
	});
});
