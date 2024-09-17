import { vi, describe, it, afterEach, expect } from 'vitest';
import { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { initFlow } from '@strivacity/sdk-core';
import { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { timestamp } from '@strivacity/sdk-core/utils/date';

import { type SDKOptions, type IdTokenClaims, LocalStorage, AuthProvider, useStrivacity } from '../src';

const options: SDKOptions = {
	issuer: 'https://brandtegrity.io',
	scopes: ['openid', 'profile'],
	clientId: '2202c596c06e4774b42804af00c66df9',
	redirectUri: 'https://brandtegrity.io/app/callback/',
	responseType: 'code',
	responseMode: 'query',
};

// eslint-disable-next-line react/display-name
const AuthProviderWrapper = ({ children }: { children?: ReactNode }) => <AuthProvider options={options}>{children}</AuthProvider>;

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

	it('should create and provide sdk instance correctly', async () => {
		const { result } = renderHook(useStrivacity, { wrapper: AuthProviderWrapper });

		expect(initFlow).toHaveBeenCalledWith(options);
		expect(subscribeToEventSpy).toHaveBeenCalledWith('loggedIn', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('sessionLoaded', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRefreshed', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRefreshFailed', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('logoutInitiated', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRevoked', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRevokeFailed', expect.any(Function));
		expect(result.current).toEqual({
			loading: true,
			isAuthenticated: false,
			idTokenClaims: null,
			accessToken: null,
			refreshToken: null,
			accessTokenExpired: true,
			accessTokenExpirationDate: null,

			login: expect.anything(),
			register: expect.anything(),
			refresh: expect.anything(),
			revoke: expect.anything(),
			logout: expect.anything(),
			handleCallback: expect.anything(),
		});

		await waitFor(() => !result.current.loading);
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
		const { result } = renderHook(useStrivacity, { wrapper: AuthProviderWrapper });

		expect(result.current.loading).toBeTruthy();
		await waitFor(() => !flow.isAuthenticated);
		expect(result.current.idTokenClaims).toBeNull();
		expect(result.current.accessToken).toBeNull();
		expect(result.current.refreshToken).toBeNull();
		expect(result.current.accessTokenExpired).toBeTruthy();
		expect(result.current.accessTokenExpirationDate).toBeNull();

		isAuthenticatedMock.mockReturnValue(Promise.resolve(true));
		idTokenClaimsMock.mockReturnValue(claims);
		accessTokenMock.mockReturnValue(accessToken);
		refreshTokenMock.mockReturnValue(refreshToken);
		accessTokenExpiredMock.mockReturnValue(false);
		accessTokenExpirationDateMock.mockReturnValue(accessTokenExpirationDate);
		// @ts-expect-error: Protected function
		flow.dispatchEvent('loggedIn', [{ accessToken, refreshToken, claims }]);

		expect(result.current.loading).toBeTruthy();
		await waitFor(() => flow.isAuthenticated);
		await waitFor(() => result.current.isAuthenticated);
		expect(result.current.idTokenClaims).toEqual(claims);
		expect(result.current.accessToken).toEqual(accessToken);
		expect(result.current.refreshToken).toEqual(refreshToken);
		expect(result.current.accessTokenExpired).toBeFalsy();
		expect(result.current.accessTokenExpirationDate).toEqual(accessTokenExpirationDate);
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
		const { result } = renderHook(useStrivacity, { wrapper: AuthProviderWrapper });

		await waitFor(() => !flow.isAuthenticated);

		result.current.login({ loginHint: 'login' });
		result.current.register({ loginHint: 'register' });
		result.current.refresh();
		result.current.revoke();
		result.current.logout({ postLogoutRedirectUri: 'uri' });
		result.current.handleCallback();

		expect(spies.login).toHaveBeenCalledWith({ loginHint: 'login' });
		expect(spies.register).toHaveBeenCalledWith({ loginHint: 'register' });
		expect(spies.refresh).toHaveBeenCalled();
		expect(spies.revoke).toHaveBeenCalled();
		expect(spies.logout).toHaveBeenCalledWith({ postLogoutRedirectUri: 'uri' });
		expect(spies.handleCallback).toHaveBeenCalled();
	});

	it('should throw error without AuthProvider', () => {
		expect(() => renderHook(useStrivacity)).toThrowError('Missing Strivacity SDK context');
	});
});
