import { vi, describe, it, afterEach, expect } from 'vitest';
import { initFlow } from '@strivacity/sdk-core';
import { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { timestamp } from '@strivacity/sdk-core/utils/date';
import { useStrivacity } from '#imports';

import { type SDKOptions, type IdTokenClaims, LocalStorage } from '../src/module';

const options: SDKOptions = {
	issuer: 'https://brandtegrity.io',
	scopes: ['openid', 'profile'],
	clientId: '2202c596c06e4774b42804af00c66df9',
	redirectUri: 'https://brandtegrity.io/app/callback/',
	responseType: 'code',
	responseMode: 'query',
};

const flow = new RedirectFlow(options, new LocalStorage());
const subscribeToEventSpy = vi.spyOn(flow, 'subscribeToEvent');
const isAuthenticatedMock = vi.fn((): Promise<boolean> => Promise.resolve(false));
const idTokenClaimsMock = vi.fn((): IdTokenClaims | null | undefined => undefined);
const accessTokenMock = vi.fn((): string | null | undefined => undefined);
const refreshTokenMock = vi.fn((): string | null | undefined => undefined);
const accessTokenExpiredMock = vi.fn((): boolean => true);
const accessTokenExpirationDateMock = vi.fn((): number | null | undefined => undefined);

Object.defineProperty(flow, 'isAuthenticated', { get: isAuthenticatedMock });
Object.defineProperty(flow, 'idTokenClaims', { get: idTokenClaimsMock });
Object.defineProperty(flow, 'accessToken', { get: accessTokenMock });
Object.defineProperty(flow, 'refreshToken', { get: refreshTokenMock });
Object.defineProperty(flow, 'accessTokenExpired', { get: accessTokenExpiredMock });
Object.defineProperty(flow, 'accessTokenExpirationDate', { get: accessTokenExpirationDateMock });

vi.mock('@strivacity/sdk-core', () => ({ initFlow: vi.fn() }));
vi.mocked(initFlow).mockReturnValue(flow);

describe('useStrivacity', () => {
	afterEach(() => {
		subscribeToEventSpy.mockClear();
		isAuthenticatedMock.mockClear();
		idTokenClaimsMock.mockClear();
		accessTokenMock.mockClear();
		refreshTokenMock.mockClear();
		accessTokenExpiredMock.mockClear();
		accessTokenExpirationDateMock.mockClear();
	});

	it('should create and provide sdk instance correctly', () => {
		const context = useStrivacity();
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { storage, storageTokenName, ...callOptions } = options;

		expect(initFlow).toHaveBeenCalledWith({ ...callOptions, storage: expect.anything() });

		expect(subscribeToEventSpy).toHaveBeenCalledWith('loggedIn', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('sessionLoaded', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRefreshed', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRefreshFailed', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('logoutInitiated', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRevoked', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRevokeFailed', expect.any(Function));

		expect(context.isAuthenticated.value).toBeFalsy();
		expect(context.idTokenClaims.value).toBeNull();
		expect(context.accessToken.value).toBeNull();
		expect(context.refreshToken.value).toBeNull();
		expect(context.accessTokenExpired.value).toBeTruthy();
		expect(context.accessTokenExpirationDate.value).toBeNull();
	});

	it('should update context correctly', async () => {
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

		expect(await flow.isAuthenticated).toBeFalsy();
		expect(context.isAuthenticated.value).toBeFalsy();
		expect(context.idTokenClaims.value).toBeNull();
		expect(context.accessToken.value).toBeNull();
		expect(context.refreshToken.value).toBeNull();
		expect(context.accessTokenExpired.value).toBeTruthy();
		expect(context.accessTokenExpirationDate.value).toBeNull();

		isAuthenticatedMock.mockReturnValue(Promise.resolve(true));
		idTokenClaimsMock.mockReturnValue(claims);
		accessTokenMock.mockReturnValue(accessToken);
		refreshTokenMock.mockReturnValue(refreshToken);
		accessTokenExpiredMock.mockReturnValue(false);
		accessTokenExpirationDateMock.mockReturnValue(accessTokenExpirationDate);
		// @ts-expect-error: Protected function
		flow.dispatchEvent('loggedIn', [{ accessToken, refreshToken, claims }]);

		expect(context.loading.value).toBeFalsy();
		expect(await flow.isAuthenticated).toBeTruthy();
		expect(context.isAuthenticated.value).toBeTruthy();
		expect(context.idTokenClaims.value).toEqual(claims);
		expect(context.accessToken.value).toEqual(accessToken);
		expect(context.refreshToken.value).toEqual(refreshToken);
		expect(context.accessTokenExpired.value).toBeFalsy();
		expect(context.accessTokenExpirationDate.value).toEqual(accessTokenExpirationDate);
	});

	it('should call sdk functions correctly', async () => {
		const spies = {
			login: vi.spyOn(flow, 'login').mockReturnValue(Promise.resolve()),
			register: vi.spyOn(flow, 'register').mockReturnValue(Promise.resolve()),
			refresh: vi.spyOn(flow, 'refresh').mockReturnValue(Promise.resolve()),
			revoke: vi.spyOn(flow, 'revoke').mockReturnValue(Promise.resolve()),
			logout: vi.spyOn(flow, 'logout').mockReturnValue(Promise.resolve()),
			handleCallback: vi.spyOn(flow, 'handleCallback').mockReturnValue(Promise.resolve()),
		};
		const { login, register, refresh, revoke, logout, handleCallback } = useStrivacity();

		await login({ loginHint: 'login' });
		await register({ loginHint: 'register' });
		await refresh();
		await revoke();
		await logout({ postLogoutRedirectUri: 'uri' });
		await handleCallback();

		expect(spies.login).toHaveBeenCalledWith({ loginHint: 'login' });
		expect(spies.register).toHaveBeenCalledWith({ loginHint: 'register' });
		expect(spies.refresh).toHaveBeenCalled();
		expect(spies.revoke).toHaveBeenCalled();
		expect(spies.logout).toHaveBeenCalledWith({ postLogoutRedirectUri: 'uri' });
		expect(spies.handleCallback).toHaveBeenCalled();
	});
});
