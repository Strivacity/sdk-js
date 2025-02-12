import { type MockInstance, vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { mocks } from '@strivacity/vitest/msw';
import { type Storage, mockLocalStorage, mockSessionStorage } from '@strivacity/vitest/mocks/storages';
import { type SDKOptions, type ExtraRequestArgs, type RedirectParams, type IdTokenClaims, initFlow } from '../../src';
import type { State } from '../../src/State';
import { jwt } from '../../src/utils/jwt';
import { SessionStorage } from '../../src/storages/SessionStorage';

const options: SDKOptions = {
	mode: 'popup',
	issuer: 'https://brandtegrity.io',
	scopes: ['openid', 'profile'],
	clientId: '2202c596c06e4774b42804af00c66df9',
	redirectUri: 'https://brandtegrity.io/app/callback/',
	responseType: 'code',
	responseMode: 'query',
};

describe('PopupFlow', () => {
	let storage: Storage = mockLocalStorage();
	const spyInitFlow = (options: SDKOptions) => {
		const flow = initFlow(options);
		const spies: Record<string, MockInstance> = {
			urlHandler: vi.spyOn(flow, 'urlHandler').mockImplementation(() => Promise.resolve()),
			exchangeCodeForTokens: vi.spyOn(flow, 'exchangeCodeForTokens'),
			// @ts-expect-error: Protected function
			fetchMetadata: vi.spyOn(flow.metadata, 'fetchMetadata'),
			// @ts-expect-error: Protected function
			dispatchEvent: vi.spyOn(flow, 'dispatchEvent'),
			// @ts-expect-error: Protected function
			sendTokenRequest: vi.spyOn<unknown>(flow, 'sendTokenRequest'),
		};

		return { flow, spies };
	};

	beforeEach(() => {
		mocks.wellKnown();
	});

	describe('initFlow', () => {
		beforeEach(() => {
			storage = mockLocalStorage();
		});

		it('should throw error w/o required params', () => {
			// @ts-expect-error: Missing options
			expect(() => initFlow({ mode: 'popup' })).toThrowError('Missing option: issuer');
			// @ts-expect-error: Missing options
			expect(() => initFlow({ mode: 'popup', issuer: options.issuer })).toThrowError('Missing option: clientId');
			// @ts-expect-error: Missing options
			expect(() => initFlow({ mode: 'popup', issuer: options.issuer, clientId: options.clientId })).toThrowError('Missing option: redirectUri');
			// @ts-expect-error: Invalid option
			expect(() => initFlow({ ...options, scopes: 'invalid' })).toThrowError('Invalid option: scopes');
			expect(() => initFlow({ mode: 'popup', issuer: options.issuer, clientId: options.clientId, redirectUri: options.redirectUri })).not.toThrowError();
		});

		it('should set non-required params correctly', () => {
			let flow = initFlow({ issuer: options.issuer, clientId: options.clientId, redirectUri: options.redirectUri });

			// @ts-expect-error: Protected option
			expect(flow.options.scopes).toEqual(['openid']);
			// @ts-expect-error: Protected option
			expect(flow.options.responseType).toEqual('code');
			// @ts-expect-error: Protected option
			expect(flow.options.responseMode).toEqual('query');
			// @ts-expect-error: Protected option
			expect(flow.options.storageTokenName).toEqual('sty.session');

			flow = initFlow({ ...options, scopes: ['custom', 'scope'], responseType: 'id_token', responseMode: 'fragment', storageTokenName: 'custom' });

			// @ts-expect-error: Protected option
			expect(flow.options.scopes).toEqual(['custom', 'scope']);
			// @ts-expect-error: Protected option
			expect(flow.options.responseType).toEqual('id_token');
			// @ts-expect-error: Protected option
			expect(flow.options.responseMode).toEqual('fragment');
			// @ts-expect-error: Protected option
			expect(flow.options.storageTokenName).toEqual('custom');
		});

		describe('should dispatch constructor events correctly', () => {
			beforeEach(() => {
				vi.useFakeTimers();
			});

			afterEach(() => {
				vi.useRealTimers();
			});

			it('init', () => {
				const { spies } = spyInitFlow(options);

				vi.advanceTimersByTime(1);

				expect(spies.dispatchEvent).toHaveBeenCalledWith('init', []);
			});

			it('sessionLoaded', () => {
				const session = storage.generateSession();
				const { spies } = spyInitFlow(options);

				vi.advanceTimersByTime(1);

				expect(spies.dispatchEvent).toHaveBeenCalledWith('sessionLoaded', [
					{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
				]);
			});

			it('accessTokenExpired', () => {
				const session = storage.generateSession({ expires_at: 0 });
				const { spies } = spyInitFlow(options);

				vi.advanceTimersByTime(1);

				expect(spies.dispatchEvent).toHaveBeenCalledWith('sessionLoaded', [
					{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
				]);
				expect(spies.dispatchEvent).toHaveBeenCalledWith('accessTokenExpired', [{ accessToken: session.access_token, refreshToken: session.refresh_token }]);
			});
		});

		it('should use another storage correctly', async () => {
			storage = mockSessionStorage();

			const { flow, spies } = spyInitFlow({ ...options, storage: SessionStorage });

			spies.exchangeCodeForTokens.mockImplementation(() => Promise.resolve());
			await flow.login();

			const state = storage.getLastState();

			expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
		});
	});

	describe('getters', () => {
		describe('isAuthenticated', () => {
			it('should send back the same promise', async () => {
				const { flow } = spyInitFlow(options);
				const promise1 = await flow.isAuthenticated;
				const promise2 = await flow.isAuthenticated;

				expect(promise1).toEqual(promise2);
			});
		});
	});

	describe('functions', () => {
		beforeEach(() => {
			storage = mockLocalStorage();
		});

		it('should throw error on metadata url error', async () => {
			const { flow, spies } = spyInitFlow(options);

			spies.fetchMetadata.mockImplementation(() => Promise.reject());

			await expect(() => flow.login()).rejects.toThrowError();
		});

		describe('login', () => {
			it('should handle popup correctly', async () => {
				let state: State | undefined;
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				spies.urlHandler.mockImplementation(
					() =>
						new Promise((resolve) => {
							state = storage.getLastState();

							session.claims = { ...(session.claims as IdTokenClaims), nonce: state?.nonce, aud: [options.clientId] };
							session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state?.nonce, aud: [options.clientId] });

							resolve({ code: 'code', state: state?.id });
						}),
				);
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await flow.login();

				const url = spies.urlHandler.mock.calls[0][0];

				expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
				expect(spies.urlHandler).toHaveBeenCalledOnce();
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

				expect(spies.exchangeCodeForTokens).toHaveBeenCalledOnce();
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loggedIn', [
					{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
				]);
			});

			it('should handle popup correctly w/ extra params', async () => {
				let state: State | undefined;
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);
				const extraParams: ExtraRequestArgs = {
					prompt: 'login',
					loginHint: 'hint',
					acrValues: ['acr', 'value'],
					uiLocales: ['hu-HU', 'en-US'],
				};

				spies.urlHandler.mockImplementation(
					() =>
						new Promise((resolve) => {
							state = storage.getLastState();

							session.claims = { ...(session.claims as IdTokenClaims), nonce: state?.nonce, aud: [options.clientId] };
							session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state?.nonce, aud: [options.clientId] });

							resolve({ code: 'code', state: state?.id });
						}),
				);
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await flow.login(extraParams);

				const url = spies.urlHandler.mock.calls[0][0];

				expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
				expect(spies.urlHandler).toHaveBeenCalledOnce();
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

				expect(spies.exchangeCodeForTokens).toHaveBeenCalledOnce();
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loggedIn', [
					{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
				]);
			});

			it('should handle popup correctly w/ redirect params', async () => {
				const { flow, spies } = spyInitFlow(options);
				const extraParams: RedirectParams = {
					targetWindow: 'top',
					locationMethod: 'replace',
				};

				spies.exchangeCodeForTokens.mockImplementation(() => Promise.resolve());
				await flow.login(extraParams);

				expect(spies.urlHandler.mock.calls[0][1]).toEqual({ locationMethod: 'replace', targetWindow: 'top' });
			});
		});

		describe('register', () => {
			it('should handle popup correctly', async () => {
				let state: State | undefined;
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				spies.urlHandler.mockImplementation(
					() =>
						new Promise((resolve) => {
							state = storage.getLastState();

							session.claims = { ...(session.claims as IdTokenClaims), nonce: state?.nonce, aud: [options.clientId] };
							session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state?.nonce, aud: [options.clientId] });

							resolve({ code: 'code', state: state?.id });
						}),
				);
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await flow.register();

				const url = spies.urlHandler.mock.calls[0][0];

				expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
				expect(spies.urlHandler).toHaveBeenCalledOnce();
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

				expect(spies.exchangeCodeForTokens).toHaveBeenCalledOnce();
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loggedIn', [
					{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
				]);
			});

			it('should handle popup correctly w/ extra params', async () => {
				let state: State | undefined;
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);
				const extraParams: ExtraRequestArgs = {
					prompt: 'create',
					loginHint: 'hint',
					acrValues: ['acr', 'value'],
					uiLocales: ['hu-HU', 'en-US'],
				};

				spies.urlHandler.mockImplementation(
					() =>
						new Promise((resolve) => {
							state = storage.getLastState();

							session.claims = { ...(session.claims as IdTokenClaims), nonce: state?.nonce, aud: [options.clientId] };
							session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state?.nonce, aud: [options.clientId] });

							resolve({ code: 'code', state: state?.id });
						}),
				);
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await flow.register(extraParams);

				const url = spies.urlHandler.mock.calls[0][0];

				expect(storage.spies.set).toHaveBeenCalledWith(`sty.${state?.id}`, JSON.stringify(state));
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loginInitiated', []);
				expect(spies.urlHandler).toHaveBeenCalledOnce();
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

				expect(spies.exchangeCodeForTokens).toHaveBeenCalledOnce();
				expect(spies.dispatchEvent).toHaveBeenCalledWith('loggedIn', [
					{ accessToken: session.access_token, refreshToken: session.refresh_token, claims: session.claims },
				]);
			});

			it('should handle popup correctly w/ redirect params', async () => {
				const { flow, spies } = spyInitFlow(options);
				const extraParams: RedirectParams = {
					targetWindow: 'top',
					locationMethod: 'replace',
				};

				spies.exchangeCodeForTokens.mockImplementation(() => Promise.resolve());
				await flow.register(extraParams);

				expect(spies.urlHandler.mock.calls[0][1]).toEqual({ prompt: 'create', locationMethod: 'replace', targetWindow: 'top' });
			});
		});

		describe('logout', () => {
			it('should do nothing w/o idToken', async () => {
				const { flow, spies } = spyInitFlow(options);

				await flow.logout();

				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.dispatchEvent).not.toHaveBeenCalledWith('logoutInitiated', expect.anything());
				expect(spies.urlHandler).not.toHaveBeenCalled();
			});

			it('should logout correctly w/o postLogoutRedirectUri', async () => {
				const session = storage.generateSession();
				const { flow, spies } = spyInitFlow(options);

				expect(await flow.isAuthenticated).toEqual(true);
				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(flow.idTokenClaims).toEqual(session.claims);

				await flow.logout();

				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.dispatchEvent).toHaveBeenCalledWith('logoutInitiated', [{ idToken: session.id_token, claims: session.claims }]);
				expect(spies.urlHandler).toHaveBeenCalledOnce();

				const url = spies.urlHandler.mock.calls[0][0];

				expect(url.origin).toEqual(options.issuer);
				expect(url.pathname).toEqual('/oauth2/sessions/logout');
				expect(url.searchParams.get('id_token_hint')).toEqual(session.id_token);
				expect(url.searchParams.has('post_logout_redirect_uri')).toBeFalsy();
			});

			it('should logout correctly w/ postLogoutRedirectUri', async () => {
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
				expect(spies.dispatchEvent).toHaveBeenCalledWith('logoutInitiated', [{ idToken: session.id_token, claims: session.claims }]);
				expect(spies.urlHandler).toHaveBeenCalledOnce();

				const url = spies.urlHandler.mock.calls[0][0];

				expect(url.origin).toEqual(options.issuer);
				expect(url.pathname).toEqual('/oauth2/sessions/logout');
				expect(url.searchParams.get('id_token_hint')).toEqual(session.id_token);
				expect(url.searchParams.get('post_logout_redirect_uri')).toEqual('https://brandtegrity.io/app/logout');
			});
		});

		describe('refresh', () => {
			it('should refresh correctly', async () => {
				const session = storage.generateSession({ expires_at: 0 });
				const refreshedSession = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => refreshedSession }));

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

			it('should refresh correctly w/ isAuthenticated', async () => {
				const session = storage.generateSession({ expires_at: 0 });
				const refreshedSession = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				spies.refresh = vi.spyOn(flow, 'refresh');
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => refreshedSession }));

				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(session.expires_at);
				expect(flow.accessToken).toEqual(session.access_token);
				expect(flow.refreshToken).toEqual(session.refresh_token);
				expect(await flow.isAuthenticated).toEqual(true);

				expect(spies.refresh).toHaveBeenCalled();

				expect(flow.accessTokenExpired).toEqual(false);
				expect(flow.accessTokenExpirationDate).toEqual(refreshedSession.expires_at);
				expect(flow.accessToken).toEqual(refreshedSession.access_token);
				expect(flow.refreshToken).toEqual(refreshedSession.refresh_token);
				expect(await flow.isAuthenticated).toEqual(true);
			});

			it('should throw an error w/ missing refresh token', async () => {
				const { flow, spies } = spyInitFlow(options);

				expect(await flow.isAuthenticated).toEqual(false);

				await expect(() => flow.refresh()).rejects.toThrowError('No refresh token available');

				expect(spies.sendTokenRequest).not.toHaveBeenCalled();
				expect(spies.dispatchEvent).not.toHaveBeenCalledWith('tokenRefreshed', expect.anything());
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
			});

			it('should not throw an error w/ invalid refresh token', async () => {
				const session = storage.generateSession({ expires_at: 0 });
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.reject());
				storage.spies.set.mockClear();

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
		});

		describe('revoke', () => {
			it('should do nothing w/o access and refresh token', async () => {
				const { flow, spies } = spyInitFlow(options);

				await flow.revoke();

				expect(storage.spies.delete).toHaveBeenCalledWith('sty.session');
				expect(spies.dispatchEvent).not.toHaveBeenCalledWith('tokenRevoked', expect.anything());
				expect(spies.urlHandler).not.toHaveBeenCalled();
			});

			it('should revoke correctly w/ refresh token', async () => {
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
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRevoked', [{ tokenTypeHint: 'refresh_token', token: session.refresh_token }]);
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
				expect(flow.idTokenClaims).toEqual(undefined);
			});

			it('should revoke correctly w/ access token', async () => {
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
				expect(spies.dispatchEvent).toHaveBeenCalledWith('tokenRevoked', [{ tokenTypeHint: 'access_token', token: session.access_token }]);
				expect(await flow.isAuthenticated).toEqual(false);
				expect(flow.accessTokenExpired).toEqual(true);
				expect(flow.accessTokenExpirationDate).toEqual(undefined);
				expect(flow.accessToken).toEqual(undefined);
				expect(flow.refreshToken).toEqual(undefined);
				expect(flow.idTokenClaims).toEqual(undefined);
			});

			it('should not throw an error w/ invalid refresh token', async () => {
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

			it('should not throw an error w/ invalid access token', async () => {
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
		});

		describe('exchangeCodeForTokens', () => {
			it('should process correctly', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({ state: JSON.stringify(state) }, null);
				const { flow, spies } = spyInitFlow(options);

				session.claims = { ...(session.claims as IdTokenClaims), nonce: state.nonce, aud: [options.clientId] };
				session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state.nonce, aud: [options.clientId] });
				storage.spies.set.mockClear();
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await flow.exchangeCodeForTokens({ code: 'code', state: state.id });

				expect(storage.spies.delete).toHaveBeenCalledWith(`sty.${state.id}`);
				expect(storage.spies.set).toHaveBeenCalledWith('sty.session', JSON.stringify(session));
			});

			it('should throw error on OIDC error', async () => {
				await storage.generateState();
				const { flow } = spyInitFlow(options);

				await expect(() => flow.exchangeCodeForTokens({ error: 'invalid_request', error_description: 'text' })).rejects.toThrowError('invalid_request: text');
			});

			it('should throw error on missing code', async () => {
				const state = await storage.generateState();
				const { flow } = spyInitFlow(options);

				await expect(() => flow.exchangeCodeForTokens({ state: state.id })).rejects.toThrowError('Invalid or missing code');
			});

			it('should throw error on invalid state', async () => {
				await storage.generateState();
				const { flow } = spyInitFlow(options);

				await expect(() => flow.exchangeCodeForTokens({ code: 'code' })).rejects.toThrowError('Invalid or missing state');
			});

			it('should throw error on invalid id_token', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({ id_token: 'invalid' }, null);
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await expect(() => flow.exchangeCodeForTokens({ code: 'code', state: state.id })).rejects.toThrowError('Invalid JWT');
			});

			it('should throw error on invalid scope', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({ scope: 'invalid' }, null);
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await expect(() => flow.exchangeCodeForTokens({ code: 'code', state: state.id })).rejects.toThrowError('Invalid scope');
			});

			it('should throw error on invalid nonce', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await expect(() => flow.exchangeCodeForTokens({ code: 'code', state: state.id })).rejects.toThrowError('Invalid nonce');
			});

			it('should throw error on invalid iss', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state.nonce, iss: 'invalid' });
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await expect(() => flow.exchangeCodeForTokens({ code: 'code', state: state.id })).rejects.toThrowError('Invalid iss');
			});

			it('should throw error on invalid aud', async () => {
				const state = await storage.generateState();
				const session = storage.generateSession({}, null);
				const { flow, spies } = spyInitFlow(options);

				session.id_token = jwt.generateUnsigned({}, { ...session.claims, nonce: state.nonce, aud: ['invalid'] });
				spies.sendTokenRequest.mockImplementation(() => Promise.resolve({ json: () => session }));

				await expect(() => flow.exchangeCodeForTokens({ code: 'code', state: state.id })).rejects.toThrowError('Invalid aud');
			});
		});

		describe('subscribeToEvent', () => {
			it('should return w/ disposable', () => {
				const { flow } = spyInitFlow(options);
				const event = flow.subscribeToEvent('init', () => undefined);

				expect(event.dispose).toBeDefined();
			});
		});
	});
});
