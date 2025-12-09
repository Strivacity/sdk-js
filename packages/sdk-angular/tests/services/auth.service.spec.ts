import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { initFlow } from '@strivacity/sdk-core';
import { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { timestamp } from '@strivacity/sdk-core/utils/date';

import { type SDKOptions, type IdTokenClaims, LocalStorage, provideStrivacity, StrivacityAuthService, HttpClient } from '../../src/public-api';

vi.mock('@strivacity/sdk-core', async () => {
	const actual = await vi.importActual('@strivacity/sdk-core');
	return {
		...actual,
		initFlow: vi.fn(),
	};
});

function spyOnObservable<T>(observable$: Observable<T>) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const next: Mock<any> = vi.fn();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const error: Mock<any> = vi.fn();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const complete: Mock<any> = vi.fn();
	const emissionCount = () => next.mock.calls.length;
	const latestEmission = (): T => {
		try {
			return next.mock.calls.at(-1)![0] as T;
		} catch {
			throw new Error('expected next to have been called');
		}
	};
	const subscription = observable$.subscribe({
		next,
		error,
		complete: () => {
			subscription?.unsubscribe();
			complete();
		},
	});

	return { next, error, complete, subscription, latestEmission, emissionCount };
}

describe('StrivacityAuthService', () => {
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
	let service: StrivacityAuthService;

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

		TestBed.configureTestingModule({
			providers: [provideStrivacity(options)],
		});

		service = TestBed.inject(StrivacityAuthService);
	});

	describe('isAuthenticated', () => {
		test('should return w/ sdk isAuthenticated value', async () => {
			expect(await firstValueFrom(service.isAuthenticated())).toBeFalsy();

			isAuthenticatedMock.mockReturnValue(Promise.resolve(true));

			expect(await firstValueFrom(service.isAuthenticated())).toBeTruthy();
		});
	});

	test('should create and provide sdk instance correctly', async () => {
		expect(initFlow).toHaveBeenCalledWith(options);

		const { latestEmission } = spyOnObservable(service.session$);
		const context = latestEmission();

		await vi.waitFor(() => expect(context?.loading).toBeTruthy());
		await vi.waitFor(() => expect(context?.isAuthenticated).toBeFalsy());
		await vi.waitFor(() => expect(context?.idTokenClaims).toBeNull());
		await vi.waitFor(() => expect(context?.accessToken).toBeNull());
		await vi.waitFor(() => expect(context?.refreshToken).toBeNull());
		await vi.waitFor(() => expect(context?.accessTokenExpired).toBeTruthy());
		await vi.waitFor(() => expect(context?.accessTokenExpirationDate).toBeNull());

		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('loggedIn', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('sessionLoaded', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRefreshed', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRefreshFailed', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('logoutInitiated', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRevoked', expect.any(Function)));
		await vi.waitFor(() => expect(flow.subscribeToEvent).toHaveBeenCalledWith('tokenRevokeFailed', expect.any(Function)));
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

		const { latestEmission } = spyOnObservable(service.session$);

		await vi.waitFor(() =>
			expect(latestEmission()).toEqual({
				loading: false,
				isAuthenticated: true,
				idTokenClaims: null,
				accessToken: null,
				refreshToken: null,
				accessTokenExpired: true,
				accessTokenExpirationDate: null,
			}),
		);

		isAuthenticatedMock.mockReturnValue(Promise.resolve(true));
		idTokenClaimsMock.mockReturnValue(claims);
		accessTokenMock.mockReturnValue(accessToken);
		refreshTokenMock.mockReturnValue(refreshToken);
		accessTokenExpiredMock.mockReturnValue(false);
		accessTokenExpirationDateMock.mockReturnValue(accessTokenExpirationDate);
		// @ts-expect-error: Protected function
		flow.dispatchEvent('init', []);

		await vi.waitFor(() =>
			expect(latestEmission()).toEqual({
				loading: false,
				isAuthenticated: true,
				idTokenClaims: flow.idTokenClaims,
				accessToken: flow.accessToken,
				refreshToken: flow.refreshToken,
				accessTokenExpired: flow.accessTokenExpired,
				accessTokenExpirationDate: flow.accessTokenExpirationDate,
			}),
		);
	});

	test('should call sdk functions correctly', () => {
		const spies = {
			login: vi.spyOn(service.sdk, 'login').mockReturnValue(Promise.resolve()),
			register: vi.spyOn(service.sdk, 'register').mockReturnValue(Promise.resolve()),
			refresh: vi.spyOn(service.sdk, 'refresh').mockReturnValue(Promise.resolve()),
			revoke: vi.spyOn(service.sdk, 'revoke').mockReturnValue(Promise.resolve()),
			entry: vi.spyOn(service.sdk, 'entry').mockReturnValue(Promise.resolve('session_id')),
			logout: vi.spyOn(service.sdk, 'logout').mockReturnValue(Promise.resolve()),
			handleCallback: vi.spyOn(service.sdk, 'handleCallback').mockReturnValue(Promise.resolve()),
		};

		service.login({ loginHint: 'login' });
		service.register({ loginHint: 'register' });
		service.refresh();
		service.revoke();
		service.entry();
		service.logout({ postLogoutRedirectUri: 'uri' });
		service.handleCallback('http://brandtegrity.io/app/callback/?code=1234');

		expect(spies.login).toHaveBeenCalledWith({ loginHint: 'login' });
		expect(spies.register).toHaveBeenCalledWith({ loginHint: 'register' });
		expect(spies.refresh).toHaveBeenCalled();
		expect(spies.revoke).toHaveBeenCalled();
		expect(spies.logout).toHaveBeenCalledWith({ postLogoutRedirectUri: 'uri' });
		expect(spies.handleCallback).toHaveBeenCalledWith('http://brandtegrity.io/app/callback/?code=1234');
	});
});
