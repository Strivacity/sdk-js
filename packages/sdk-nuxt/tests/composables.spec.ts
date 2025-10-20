import { vi, describe, test, beforeEach, expect } from 'vitest';
import { initFlow } from '@strivacity/sdk-core';
import { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { timestamp } from '@strivacity/sdk-core/utils/date';

import { useStrivacity } from '#imports';
import { type SDKOptions, type IdTokenClaims, LocalStorage, HttpClient } from '../src/module';

vi.mock('@strivacity/sdk-core', async () => {
	const actual = await vi.importActual('@strivacity/sdk-core');
	return {
		...actual,
		initFlow: vi.fn(),
	};
});

describe('useStrivacity', () => {
	const options: SDKOptions = {
		mode: 'redirect',
		issuer: 'https://brandtegrity.io',
		scopes: ['openid', 'profile'],
		clientId: '2202c596c06e4774b42804af00c66df9',
		redirectUri: 'https://brandtegrity.io/app/callback/',
		responseType: 'code',
		responseMode: 'query',
	};
	const isAuthenticatedMock = vi.fn((): Promise<boolean> => Promise.resolve(false));
	const idTokenClaimsMock = vi.fn((): IdTokenClaims | null | undefined => undefined);
	const accessTokenMock = vi.fn((): string | null | undefined => undefined);
	const refreshTokenMock = vi.fn((): string | null | undefined => undefined);
	const accessTokenExpiredMock = vi.fn((): boolean => true);
	const accessTokenExpirationDateMock = vi.fn((): number | null | undefined => undefined);
	let flow: RedirectFlow;

	beforeEach(() => {
		flow = new RedirectFlow(options, new LocalStorage(), new HttpClient());

		Object.defineProperty(flow, 'isAuthenticated', { get: isAuthenticatedMock });
		Object.defineProperty(flow, 'idTokenClaims', { get: idTokenClaimsMock });
		Object.defineProperty(flow, 'accessToken', { get: accessTokenMock });
		Object.defineProperty(flow, 'refreshToken', { get: refreshTokenMock });
		Object.defineProperty(flow, 'accessTokenExpired', { get: accessTokenExpiredMock });
		Object.defineProperty(flow, 'accessTokenExpirationDate', { get: accessTokenExpirationDateMock });

		vi.spyOn(flow, 'subscribeToEvent');
		vi.mocked(initFlow).mockReturnValue(flow);
	});

	test('should create and provide sdk instance correctly', async () => {
		const context = useStrivacity();
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { mode, storage, storageTokenName, httpClient, urlHandler, callbackHandler, ...callOptions } = options;

		expect(initFlow).toHaveBeenCalledWith({ ...callOptions, storage: expect.anything() });

		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('loggedIn', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('sessionLoaded', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRefreshed', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRefreshFailed', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('logoutInitiated', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRevoked', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRevokeFailed', expect.any(Function)));

		await vi.waitFor(() => expect(context.loading.value).toBeTruthy());
		await vi.waitFor(() => expect(context.isAuthenticated.value).toBeFalsy());
		await vi.waitFor(() => expect(context.idTokenClaims.value).toBeNull());
		await vi.waitFor(() => expect(context.accessToken.value).toBeNull());
		await vi.waitFor(() => expect(context.refreshToken.value).toBeNull());
		await vi.waitFor(() => expect(context.accessTokenExpired.value).toBeTruthy());
		await vi.waitFor(() => expect(context.accessTokenExpirationDate.value).toBeNull());
	});

	test('should update context correctly', async () => {
		const claims = {
			iss: 'https://brandtegrity.io/',
			aud: [crypto.randomUUID().replace(/-/g, '')],
			nonce: crypto.randomUUID().replace(/-/g, ''),
			auth_time: timestamp(),
			exp: timestamp(),
			iat: timestamp(),
			jti: crypto.randomUUID(),
			sid: crypto.randomUUID(),
			sub: crypto.randomUUID(),
		};
		const accessToken = 'accessToken';
		const refreshToken = 'refreshToken';
		const accessTokenExpirationDate = timestamp() + 3600;
		const context = useStrivacity();

		await vi.waitFor(() => expect(context.loading.value).toBeFalsy());
		await vi.waitFor(() => expect(context.isAuthenticated.value).toBeFalsy());
		await vi.waitFor(() => expect(context.idTokenClaims.value).toBeNull());
		await vi.waitFor(() => expect(context.accessToken.value).toBeNull());
		await vi.waitFor(() => expect(context.refreshToken.value).toBeNull());
		await vi.waitFor(() => expect(context.accessTokenExpired.value).toBeTruthy());
		await vi.waitFor(() => expect(context.accessTokenExpirationDate.value).toBeNull());

		isAuthenticatedMock.mockReturnValue(Promise.resolve(true));
		idTokenClaimsMock.mockReturnValue(claims);
		accessTokenMock.mockReturnValue(accessToken);
		refreshTokenMock.mockReturnValue(refreshToken);
		accessTokenExpiredMock.mockReturnValue(false);
		accessTokenExpirationDateMock.mockReturnValue(accessTokenExpirationDate);
		// @ts-expect-error: Protected function
		flow.dispatchEvent('init', []);

		await vi.waitFor(() => expect(context.loading.value).toBeFalsy());
		await vi.waitFor(() => expect(context.isAuthenticated.value).toBeTruthy());
		await vi.waitFor(() => expect(context.idTokenClaims.value).toEqual(claims));
		await vi.waitFor(() => expect(context.accessToken.value).toEqual(accessToken));
		await vi.waitFor(() => expect(context.refreshToken.value).toEqual(refreshToken));
		await vi.waitFor(() => expect(context.accessTokenExpired.value).toBeFalsy());
		await vi.waitFor(() => expect(context.accessTokenExpirationDate.value).toEqual(accessTokenExpirationDate));
	});

	test('should call sdk functions correctly', async () => {
		const { sdk, login, register, refresh, revoke, entry, logout, handleCallback } = useStrivacity();
		const spies = {
			login: vi.spyOn(sdk, 'login').mockReturnValue(Promise.resolve()),
			register: vi.spyOn(sdk, 'register').mockReturnValue(Promise.resolve()),
			refresh: vi.spyOn(sdk, 'refresh').mockReturnValue(Promise.resolve()),
			revoke: vi.spyOn(sdk, 'revoke').mockReturnValue(Promise.resolve()),
			entry: vi.spyOn(sdk, 'entry').mockReturnValue(Promise.resolve('session_id')),
			logout: vi.spyOn(sdk, 'logout').mockReturnValue(Promise.resolve()),
			handleCallback: vi.spyOn(sdk, 'handleCallback').mockReturnValue(Promise.resolve()),
		};

		await login({ loginHint: 'login' });
		await register({ loginHint: 'register' });
		await refresh();
		await revoke();
		await entry();
		await logout({ postLogoutRedirectUri: 'uri' });
		await handleCallback('http://brandtegrity.io/app/callback/?code=1234');

		expect(spies.login).toHaveBeenCalledWith({ loginHint: 'login' });
		expect(spies.register).toHaveBeenCalledWith({ loginHint: 'register' });
		expect(spies.refresh).toHaveBeenCalled();
		expect(spies.revoke).toHaveBeenCalled();
		expect(spies.entry).toHaveBeenCalled();
		expect(spies.logout).toHaveBeenCalledWith({ postLogoutRedirectUri: 'uri' });
		expect(spies.handleCallback).toHaveBeenCalledWith('http://brandtegrity.io/app/callback/?code=1234');
	});
});
