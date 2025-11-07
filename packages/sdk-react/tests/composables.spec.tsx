import { vi, describe, it, beforeEach, expect } from 'vitest';
import { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { initFlow } from '@strivacity/sdk-core';
import { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { timestamp } from '@strivacity/sdk-core/utils/date';

import { type SDKOptions, type IdTokenClaims, LocalStorage, StyAuthProvider, useStrivacity } from '../src';

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
	const isAuthenticatedMock = vi.fn((): boolean => false);
	const idTokenClaimsMock = vi.fn((): IdTokenClaims | null | undefined => undefined);
	const accessTokenMock = vi.fn((): string | null | undefined => undefined);
	const refreshTokenMock = vi.fn((): string | null | undefined => undefined);
	const accessTokenExpiredMock = vi.fn((): boolean => true);
	const accessTokenExpirationDateMock = vi.fn((): number | null | undefined => undefined);
	let flow: RedirectFlow;
	const AuthProviderWrapper = ({ children }: { children?: ReactNode }) => <StyAuthProvider options={options}>{children}</StyAuthProvider>;

	beforeEach(() => {
		flow = new RedirectFlow(options, new LocalStorage());

		Object.defineProperty(flow, 'isAuthenticated', { get: isAuthenticatedMock });
		Object.defineProperty(flow, 'idTokenClaims', { get: idTokenClaimsMock });
		Object.defineProperty(flow, 'accessToken', { get: accessTokenMock });
		Object.defineProperty(flow, 'refreshToken', { get: refreshTokenMock });
		Object.defineProperty(flow, 'accessTokenExpired', { get: accessTokenExpiredMock });
		Object.defineProperty(flow, 'accessTokenExpirationDate', { get: accessTokenExpirationDateMock });

		vi.spyOn(flow, 'subscribeToEvent');
		vi.mocked(initFlow).mockReturnValue(flow);
	});

	it('should create and provide sdk instance correctly', async () => {
		const { result } = renderHook(useStrivacity, { wrapper: AuthProviderWrapper });

		await vi.waitFor(() => expect(initFlow).toHaveBeenCalledWith(options));

		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('init', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('loggedIn', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('sessionLoaded', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRefreshed', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRefreshFailed', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('logoutInitiated', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRevoked', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRevokeFailed', expect.any(Function)));

		// Wait for initial loading state
		await vi.waitFor(() => expect(result.current.loading).toBeTruthy());

		// Trigger the init callback to update the session
		const initCallback = vi.mocked(flow.subscribeToEvent).mock.calls.find((call) => call[0] === 'init')?.[1];
		if (initCallback) {
			await initCallback();
		}

		await vi.waitFor(() =>
			expect(result.current).toEqual({
				sdk: expect.anything(),
				loading: false,
				options: options,
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
				entry: expect.anything(),
				logout: expect.anything(),
				handleCallback: expect.anything(),
			}),
		);
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
		const hook = renderHook(useStrivacity, { wrapper: AuthProviderWrapper });

		await vi.waitFor(() => expect(hook.result.current.loading).toBeTruthy());
		await vi.waitFor(() => expect(hook.result.current.isAuthenticated).toBeFalsy());
		await vi.waitFor(() => expect(hook.result.current.idTokenClaims).toBeNull());
		await vi.waitFor(() => expect(hook.result.current.accessToken).toBeNull());
		await vi.waitFor(() => expect(hook.result.current.refreshToken).toBeNull());
		await vi.waitFor(() => expect(hook.result.current.accessTokenExpired).toBeTruthy());
		await vi.waitFor(() => expect(hook.result.current.accessTokenExpirationDate).toBeNull());

		isAuthenticatedMock.mockReturnValue(true);
		idTokenClaimsMock.mockReturnValue(claims);
		accessTokenMock.mockReturnValue(accessToken);
		refreshTokenMock.mockReturnValue(refreshToken);
		accessTokenExpiredMock.mockReturnValue(false);
		accessTokenExpirationDateMock.mockReturnValue(accessTokenExpirationDate);

		// Get the callback function that was registered with subscribeToEvent
		const initCallback = vi.mocked(flow.subscribeToEvent).mock.calls.find((call) => call[0] === 'init')?.[1];
		if (initCallback) {
			await initCallback();
		}

		hook.rerender();

		// TODO: Fix this later

		// await vi.waitFor(() => expect(hook.result.current.loading).toBeFalsy());
		// await vi.waitFor(() => expect(hook.result.current.isAuthenticated).toBeTruthy());
		// await vi.waitFor(() => expect(hook.result.current.idTokenClaims).toEqual(claims));
		// await vi.waitFor(() => expect(hook.result.current.accessToken).toEqual(accessToken));
		// await vi.waitFor(() => expect(hook.result.current.refreshToken).toEqual(refreshToken));
		// await vi.waitFor(() => expect(hook.result.current.accessTokenExpired).toBeFalsy());
		// await vi.waitFor(() => expect(hook.result.current.accessTokenExpirationDate).toEqual(accessTokenExpirationDate));
	});

	it('should call sdk functions correctly', async () => {
		const { result } = renderHook(useStrivacity, { wrapper: AuthProviderWrapper });
		const spies = {
			login: vi.spyOn(result.current.sdk, 'login').mockReturnValue(Promise.resolve()),
			register: vi.spyOn(result.current.sdk, 'register').mockReturnValue(Promise.resolve()),
			refresh: vi.spyOn(result.current.sdk, 'refresh').mockReturnValue(Promise.resolve()),
			revoke: vi.spyOn(result.current.sdk, 'revoke').mockReturnValue(Promise.resolve()),
			logout: vi.spyOn(result.current.sdk, 'logout').mockReturnValue(Promise.resolve()),
			handleCallback: vi.spyOn(result.current.sdk, 'handleCallback').mockReturnValue(Promise.resolve()),
		};

		await waitFor(async () => !(await flow.isAuthenticated));

		await result.current.login({ loginHint: 'login' });
		await result.current.register({ loginHint: 'register' });
		await result.current.refresh();
		await result.current.revoke();
		await result.current.logout({ postLogoutRedirectUri: 'uri' });
		await result.current.handleCallback('http://brandtegrity.io/app/callback/?code=1234');

		expect(spies.login).toHaveBeenCalledWith({ loginHint: 'login' });
		expect(spies.register).toHaveBeenCalledWith({ loginHint: 'register' });
		expect(spies.refresh).toHaveBeenCalled();
		expect(spies.revoke).toHaveBeenCalled();
		expect(spies.logout).toHaveBeenCalledWith({ postLogoutRedirectUri: 'uri' });
		expect(spies.handleCallback).toHaveBeenCalledWith('http://brandtegrity.io/app/callback/?code=1234');
	});

	it('should throw error without AuthProvider', () => {
		expect(() => renderHook(useStrivacity)).toThrowError('Missing Strivacity SDK context');
	});
});
