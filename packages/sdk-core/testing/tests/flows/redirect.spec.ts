import { beforeEach, describe, test, expect, vi } from 'vitest';
import { createOptions, getMockStorage } from '@strivacity/testing/mocks/sdk';
import { createRedirectFlow } from '../../../src/flows/redirect';

describe('createRedirectFlow', () => {
	let options: ReturnType<typeof createOptions>;
	let flow: ReturnType<typeof createRedirectFlow>;

	beforeEach(() => {
		options = createOptions({ urlHandler: vi.fn() });
		flow = createRedirectFlow(options);
	});

	describe('init', () => {
		test('lazyLoad: true', async () => {
			flow = createRedirectFlow(createOptions({ lazyLoad: true }));

			// We need to wait for the next tick to ensure that any asynchronous initialization logic has a chance to run before we check the initialized state.
			await Promise.resolve();

			expect(flow.initialized).toBe(false);

			await flow.init();

			expect(flow.initialized).toBe(true);
		});

		test('lazyLoad: false', async () => {
			flow = createRedirectFlow(createOptions({ lazyLoad: false }));

			await vi.waitFor(() => expect(flow.initialized).toBe(true));
		});
	});

	describe('login', () => {
		describe('w/o serverSessionUri', () => {
			test('w/o params', async () => {
				await flow.login();

				expect(flow.options.urlHandler).toHaveBeenCalledWith(expect.any(URL), {});

				const stateData = getMockStorage(options.stateStorage).getLastState();
				const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];

				expect(`${url.origin}${url.pathname}`).toBe('https://brandtegrity.io/oauth2/auth');
				expect(url.searchParams.get('client_id')).toBe('client-id');
				expect(url.searchParams.get('redirect_uri')).toBe('https://brandtegrity.io/callback');
				expect(url.searchParams.get('response_type')).toBe('code');
				expect(url.searchParams.get('response_mode')).toBe('query');
				expect(url.searchParams.get('scope')).toBe('openid');
				expect(url.searchParams.get('code_challenge_method')).toBe('S256');
				expect(url.searchParams.get('state')).toBe(stateData?.id);
				expect(url.searchParams.get('code_challenge')).toBe(stateData?.codeChallenge);
				expect(url.searchParams.get('nonce')).toBe(stateData?.nonce);
				expect(url.searchParams.has('prompt')).toBeFalsy();
				expect(url.searchParams.has('display')).toBeFalsy();
				expect(url.searchParams.has('login_hint')).toBeFalsy();
				expect(url.searchParams.has('acr_values')).toBeFalsy();
				expect(url.searchParams.has('ui_locales')).toBeFalsy();
				expect(url.searchParams.has('audience')).toBeFalsy();
				expect(params).toEqual({});
			});

			test('w/ params', async () => {
				const extraParams = {
					prompt: 'login',
					display: 'page',
					loginHint: 'test@example.com',
					acrValues: ['urn:mace:incommon:iap:silver', 'urn:mace:incommon:iap:bronze'],
					uiLocales: ['en-US', 'hu-HU'],
					audiences: ['https://api.example.com', 'https://api2.example.com'],
				};

				await flow.login(extraParams);

				expect(flow.options.urlHandler).toHaveBeenCalledWith(expect.any(URL), extraParams);

				const stateData = getMockStorage(options.stateStorage).getLastState();
				const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];

				expect(`${url.origin}${url.pathname}`).toBe('https://brandtegrity.io/oauth2/auth');
				expect(url.searchParams.get('client_id')).toBe('client-id');
				expect(url.searchParams.get('redirect_uri')).toBe('https://brandtegrity.io/callback');
				expect(url.searchParams.get('response_type')).toBe('code');
				expect(url.searchParams.get('response_mode')).toBe('query');
				expect(url.searchParams.get('scope')).toBe('openid');
				expect(url.searchParams.get('code_challenge_method')).toBe('S256');
				expect(url.searchParams.get('state')).toBe(stateData?.id);
				expect(url.searchParams.get('code_challenge')).toBe(stateData?.codeChallenge);
				expect(url.searchParams.get('nonce')).toBe(stateData?.nonce);
				expect(url.searchParams.get('prompt')).toBe('login');
				expect(url.searchParams.get('display')).toBe('page');
				expect(url.searchParams.get('login_hint')).toBe('test@example.com');
				expect(url.searchParams.get('acr_values')).toBe('urn:mace:incommon:iap:silver urn:mace:incommon:iap:bronze');
				expect(url.searchParams.get('ui_locales')).toBe('en-US hu-HU');
				expect(url.searchParams.get('audience')).toBe('https://api.example.com https://api2.example.com');
				expect(params).toEqual(extraParams);
			});
		});

		describe('w/ serverSessionUri', () => {
			test('w/o params', async () => {
				options = createOptions({ urlHandler: vi.fn(), serverSessionUri: 'https://app.example.com/login' });
				flow = createRedirectFlow(options);

				await flow.login();

				expect(flow.options.urlHandler).toHaveBeenCalledWith(expect.any(URL), {});

				const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];

				expect(`${url.origin}${url.pathname}`).toBe('https://app.example.com/login');
				expect(url.searchParams.has('client_id')).toBeFalsy();
				expect(url.searchParams.has('redirect_uri')).toBeFalsy();
				expect(url.searchParams.has('response_type')).toBeFalsy();
				expect(url.searchParams.has('response_mode')).toBeFalsy();
				expect(url.searchParams.has('scope')).toBeFalsy();
				expect(url.searchParams.has('code_challenge_method')).toBeFalsy();
				expect(url.searchParams.has('state')).toBeFalsy();
				expect(url.searchParams.has('code_challenge')).toBeFalsy();
				expect(url.searchParams.has('nonce')).toBeFalsy();
				expect(url.searchParams.has('prompt')).toBeFalsy();
				expect(url.searchParams.has('display')).toBeFalsy();
				expect(url.searchParams.has('login_hint')).toBeFalsy();
				expect(url.searchParams.has('acr_values')).toBeFalsy();
				expect(url.searchParams.has('ui_locales')).toBeFalsy();
				expect(url.searchParams.has('audience')).toBeFalsy();
				expect(params).toEqual({});
			});

			test('w/ params', async () => {
				options = createOptions({ urlHandler: vi.fn(), serverSessionUri: 'https://app.example.com/login' });
				flow = createRedirectFlow(options);

				const extraParams = {
					prompt: 'login',
					display: 'page',
					loginHint: 'test@example.com',
					acrValues: ['urn:mace:incommon:iap:silver', 'urn:mace:incommon:iap:bronze'],
					uiLocales: ['en-US', 'hu-HU'],
					audiences: ['https://api.example.com', 'https://api2.example.com'],
				};

				await flow.login(extraParams);

				expect(flow.options.urlHandler).toHaveBeenCalledWith(expect.any(URL), extraParams);

				const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];

				expect(`${url.origin}${url.pathname}`).toBe('https://app.example.com/login');
				expect(url.searchParams.has('client_id')).toBeFalsy();
				expect(url.searchParams.has('redirect_uri')).toBeFalsy();
				expect(url.searchParams.has('response_type')).toBeFalsy();
				expect(url.searchParams.has('response_mode')).toBeFalsy();
				expect(url.searchParams.has('scope')).toBeFalsy();
				expect(url.searchParams.has('code_challenge_method')).toBeFalsy();
				expect(url.searchParams.has('state')).toBeFalsy();
				expect(url.searchParams.has('code_challenge')).toBeFalsy();
				expect(url.searchParams.has('nonce')).toBeFalsy();
				expect(url.searchParams.get('prompt')).toBe('login');
				expect(url.searchParams.get('display')).toBe('page');
				expect(url.searchParams.get('login_hint')).toBe('test@example.com');
				expect(url.searchParams.get('acr_values')).toBe('urn:mace:incommon:iap:silver urn:mace:incommon:iap:bronze');
				expect(url.searchParams.get('ui_locales')).toBe('en-US hu-HU');
				expect(url.searchParams.get('audience')).toBe('https://api.example.com https://api2.example.com');
				expect(params).toEqual(extraParams);
			});
		});
	});

	describe('register', () => {
		describe('w/o serverSessionUri', () => {
			test('w/o params', async () => {
				await flow.register();

				expect(flow.options.urlHandler).toHaveBeenCalledWith(expect.any(URL), { prompt: 'create' });

				const stateData = getMockStorage(options.stateStorage).getLastState();
				const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];

				expect(`${url.origin}${url.pathname}`).toBe('https://brandtegrity.io/oauth2/auth');
				expect(url.searchParams.get('client_id')).toBe('client-id');
				expect(url.searchParams.get('redirect_uri')).toBe('https://brandtegrity.io/callback');
				expect(url.searchParams.get('response_type')).toBe('code');
				expect(url.searchParams.get('response_mode')).toBe('query');
				expect(url.searchParams.get('scope')).toBe('openid');
				expect(url.searchParams.get('code_challenge_method')).toBe('S256');
				expect(url.searchParams.get('state')).toBe(stateData?.id);
				expect(url.searchParams.get('code_challenge')).toBe(stateData?.codeChallenge);
				expect(url.searchParams.get('nonce')).toBe(stateData?.nonce);
				expect(url.searchParams.get('prompt')).toBe('create');
				expect(url.searchParams.has('display')).toBeFalsy();
				expect(url.searchParams.has('login_hint')).toBeFalsy();
				expect(url.searchParams.has('acr_values')).toBeFalsy();
				expect(url.searchParams.has('ui_locales')).toBeFalsy();
				expect(url.searchParams.has('audience')).toBeFalsy();
				expect(params).toEqual({ prompt: 'create' });
			});

			test('w/ params', async () => {
				const extraParams = {
					prompt: 'create',
					display: 'page',
					loginHint: 'test@example.com',
					acrValues: ['urn:mace:incommon:iap:silver', 'urn:mace:incommon:iap:bronze'],
					uiLocales: ['en-US', 'hu-HU'],
					audiences: ['https://api.example.com', 'https://api2.example.com'],
				};

				await flow.register({ ...extraParams, prompt: undefined });

				expect(flow.options.urlHandler).toHaveBeenCalledWith(expect.any(URL), extraParams);

				const stateData = getMockStorage(options.stateStorage).getLastState();
				const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];

				expect(`${url.origin}${url.pathname}`).toBe('https://brandtegrity.io/oauth2/auth');
				expect(url.searchParams.get('client_id')).toBe('client-id');
				expect(url.searchParams.get('redirect_uri')).toBe('https://brandtegrity.io/callback');
				expect(url.searchParams.get('response_type')).toBe('code');
				expect(url.searchParams.get('response_mode')).toBe('query');
				expect(url.searchParams.get('scope')).toBe('openid');
				expect(url.searchParams.get('code_challenge_method')).toBe('S256');
				expect(url.searchParams.get('state')).toBe(stateData?.id);
				expect(url.searchParams.get('code_challenge')).toBe(stateData?.codeChallenge);
				expect(url.searchParams.get('nonce')).toBe(stateData?.nonce);
				expect(url.searchParams.get('prompt')).toBe('create');
				expect(url.searchParams.get('display')).toBe('page');
				expect(url.searchParams.get('login_hint')).toBe('test@example.com');
				expect(url.searchParams.get('acr_values')).toBe('urn:mace:incommon:iap:silver urn:mace:incommon:iap:bronze');
				expect(url.searchParams.get('ui_locales')).toBe('en-US hu-HU');
				expect(url.searchParams.get('audience')).toBe('https://api.example.com https://api2.example.com');
				expect(params).toEqual(extraParams);
			});
		});

		describe('w/ serverSessionUri', () => {
			test('w/o params', async () => {
				options = createOptions({ urlHandler: vi.fn(), serverSessionUri: 'https://app.example.com/login' });
				flow = createRedirectFlow(options);

				await flow.register();

				expect(flow.options.urlHandler).toHaveBeenCalledWith(expect.any(URL), { prompt: 'create' });

				const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];

				expect(`${url.origin}${url.pathname}`).toBe('https://app.example.com/login');
				expect(url.searchParams.has('client_id')).toBeFalsy();
				expect(url.searchParams.has('redirect_uri')).toBeFalsy();
				expect(url.searchParams.has('response_type')).toBeFalsy();
				expect(url.searchParams.has('response_mode')).toBeFalsy();
				expect(url.searchParams.has('scope')).toBeFalsy();
				expect(url.searchParams.has('code_challenge_method')).toBeFalsy();
				expect(url.searchParams.has('state')).toBeFalsy();
				expect(url.searchParams.has('code_challenge')).toBeFalsy();
				expect(url.searchParams.has('nonce')).toBeFalsy();
				expect(url.searchParams.get('prompt')).toBe('create');
				expect(url.searchParams.has('display')).toBeFalsy();
				expect(url.searchParams.has('login_hint')).toBeFalsy();
				expect(url.searchParams.has('acr_values')).toBeFalsy();
				expect(url.searchParams.has('ui_locales')).toBeFalsy();
				expect(url.searchParams.has('audience')).toBeFalsy();
				expect(params).toEqual({ prompt: 'create' });
			});

			test('w/ params', async () => {
				options = createOptions({ urlHandler: vi.fn(), serverSessionUri: 'https://app.example.com/login' });
				flow = createRedirectFlow(options);

				const extraParams = {
					prompt: 'create',
					display: 'page',
					loginHint: 'test@example.com',
					acrValues: ['urn:mace:incommon:iap:silver', 'urn:mace:incommon:iap:bronze'],
					uiLocales: ['en-US', 'hu-HU'],
					audiences: ['https://api.example.com', 'https://api2.example.com'],
				};

				await flow.register({ ...extraParams, prompt: undefined });

				expect(flow.options.urlHandler).toHaveBeenCalledWith(expect.any(URL), extraParams);

				const [url, params] = vi.mocked(options.urlHandler).mock.calls[0] as [URL, Record<string, unknown>];

				expect(`${url.origin}${url.pathname}`).toBe('https://app.example.com/login');
				expect(url.searchParams.has('client_id')).toBeFalsy();
				expect(url.searchParams.has('redirect_uri')).toBeFalsy();
				expect(url.searchParams.has('response_type')).toBeFalsy();
				expect(url.searchParams.has('response_mode')).toBeFalsy();
				expect(url.searchParams.has('scope')).toBeFalsy();
				expect(url.searchParams.has('code_challenge_method')).toBeFalsy();
				expect(url.searchParams.has('state')).toBeFalsy();
				expect(url.searchParams.has('code_challenge')).toBeFalsy();
				expect(url.searchParams.has('nonce')).toBeFalsy();
				expect(url.searchParams.get('prompt')).toBe('create');
				expect(url.searchParams.get('display')).toBe('page');
				expect(url.searchParams.get('login_hint')).toBe('test@example.com');
				expect(url.searchParams.get('acr_values')).toBe('urn:mace:incommon:iap:silver urn:mace:incommon:iap:bronze');
				expect(url.searchParams.get('ui_locales')).toBe('en-US hu-HU');
				expect(url.searchParams.get('audience')).toBe('https://api.example.com https://api2.example.com');
				expect(params).toEqual(extraParams);
			});
		});
	});

	describe('entry', () => {
		test('should redirect to the provider entry endpoint preserving query parameters', async () => {
			await flow.entry('https://brandtegrity.io/entry?challenge=abc123&foo=bar');

			const [url, params] = vi.mocked(options.urlHandler).mock.calls[0];

			expect((url as URL).toString()).toBe('https://brandtegrity.io/provider/entry?challenge=abc123&foo=bar');
			expect(params).toBeUndefined();
		});

		test('should default to the current window location when no url is provided', async () => {
			window.location.search = '?challenge=abc123&foo=bar';

			await flow.entry();

			const [url] = vi.mocked(options.urlHandler).mock.calls[0];

			expect((url as URL).toString()).toBe('https://brandtegrity.io/provider/entry?challenge=abc123&foo=bar');
		});
	});

	test('flow state accessors', async () => {
		options = createOptions({ lazyLoad: true, urlHandler: vi.fn() });
		flow = createRedirectFlow(options);

		expect(flow.options).toBe(options);
		expect(flow.initialized).toBeFalsy();
		expect(flow.storage).toBe(options.storage);
		expect(flow.httpClient).toBe(options.httpClient);
		expect(flow.logging).toBe(options.logging);
		expect(flow.sessionId).toBeNull();
		expect(flow.shortAppId).toBeNull();
		expect(flow.language).toBe('en-US');
		await expect(flow.isAuthenticated).resolves.toBeFalsy();
		expect(flow.isAuthenticatedSync).toBeFalsy();
		expect(flow.accessToken).toBeNull();
		expect(flow.accessTokenExpired).toBeTruthy();
		expect(flow.accessTokenExpirationDate).toBeNull();
		expect(flow.refreshToken).toBeNull();
		expect(flow.idToken).toBeNull();
		expect(flow.idTokenClaims).toBeNull();

		await flow.init();

		flow.sessionId = 'abc123';
		flow.shortAppId = 'app';
		flow.language = 'hu-HU';
		flow.session = getMockStorage(options.storage).generateSession();

		expect(flow.initialized).toBeTruthy();
		expect(flow.sessionId).toBe('abc123');
		expect(flow.shortAppId).toBe('app');
		expect(flow.language).toBe('hu-HU');
		await expect(flow.isAuthenticated).resolves.toBeTruthy();
		expect(flow.isAuthenticatedSync).toBeTruthy();
		expect(flow.accessToken).toBe(flow.session.access_token);
		expect(flow.accessTokenExpired).toBeFalsy();
		expect(flow.accessTokenExpirationDate).toBe(flow.session.expires_at);
		expect(flow.refreshToken).toBe(flow.session.refresh_token);
		expect(flow.idToken).toBe(flow.session.id_token);
		expect(flow.idTokenClaims).toBe(flow.session?.claims);
	});
});
