import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { vi, describe, beforeEach, afterEach, it, expect, Mock } from 'vitest';
import { initFlow } from '@strivacity/sdk-core';
import { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { timestamp } from '@strivacity/sdk-core/utils/date';

import { type SDKOptions, type IdTokenClaims, LocalStorage, provideStrivacity, StrivacityAuthService } from '../src/public-api';

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
		} catch (e) {
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
	let service: StrivacityAuthService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideStrivacity(options)],
		});

		service = TestBed.inject(StrivacityAuthService);
	});

	afterEach(() => {
		subscribeToEventSpy.mockClear();
		isAuthenticatedMock.mockClear();
		idTokenClaimsMock.mockClear();
		accessTokenMock.mockClear();
		refreshTokenMock.mockClear();
		accessTokenExpiredMock.mockClear();
		accessTokenExpirationDateMock.mockClear();
	});

	describe('isAuthenticated', () => {
		it('should return w/ sdk isAuthenticated value', async () => {
			expect(await firstValueFrom(service.isAuthenticated())).toBeFalsy();

			isAuthenticatedMock.mockReturnValue(Promise.resolve(true));

			expect(await firstValueFrom(service.isAuthenticated())).toBeTruthy();
		});
	});

	it('should create and provide sdk instance correctly', async () => {
		expect(initFlow).toHaveBeenCalledWith(options);

		const { latestEmission } = spyOnObservable(service.session$);
		const context = latestEmission();

		expect(context?.loading).toBeTruthy();
		expect(context?.isAuthenticated).toBeFalsy();
		expect(context?.idTokenClaims).toBeNull();
		expect(context?.accessToken).toBeNull();
		expect(context?.refreshToken).toBeNull();
		expect(context?.accessTokenExpired).toBeTruthy();
		expect(context?.accessTokenExpirationDate).toBeNull();

		expect(subscribeToEventSpy).toHaveBeenCalledWith('loggedIn', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('sessionLoaded', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRefreshed', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRefreshFailed', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('logoutInitiated', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRevoked', expect.any(Function));
		expect(subscribeToEventSpy).toHaveBeenCalledWith('tokenRevokeFailed', expect.any(Function));
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

		const { latestEmission } = spyOnObservable(service.session$);

		expect(latestEmission()).toEqual({
			loading: true,
			isAuthenticated: false,
			idTokenClaims: null,
			accessToken: null,
			refreshToken: null,
			accessTokenExpired: true,
			accessTokenExpirationDate: null,
		});

		isAuthenticatedMock.mockReturnValue(Promise.resolve(true));
		idTokenClaimsMock.mockReturnValue(claims);
		accessTokenMock.mockReturnValue(accessToken);
		refreshTokenMock.mockReturnValue(refreshToken);
		accessTokenExpiredMock.mockReturnValue(false);
		accessTokenExpirationDateMock.mockReturnValue(accessTokenExpirationDate);
		// @ts-expect-error: Protected function
		flow.dispatchEvent('init', []);

		await vi.waitFor(() => {
			expect(latestEmission()).toEqual({
				loading: false,
				isAuthenticated: true,
				idTokenClaims: flow.idTokenClaims,
				accessToken: flow.accessToken,
				refreshToken: flow.refreshToken,
				accessTokenExpired: flow.accessTokenExpired,
				accessTokenExpirationDate: flow.accessTokenExpirationDate,
			});
		});
	});

	it('should call sdk functions correctly', () => {
		const spies = {
			login: vi.spyOn(flow, 'login').mockReturnValue(Promise.resolve()),
			register: vi.spyOn(flow, 'register').mockReturnValue(Promise.resolve()),
			refresh: vi.spyOn(flow, 'refresh').mockReturnValue(Promise.resolve()),
			revoke: vi.spyOn(flow, 'revoke').mockReturnValue(Promise.resolve()),
			logout: vi.spyOn(flow, 'logout').mockReturnValue(Promise.resolve()),
			handleCallback: vi.spyOn(flow, 'handleCallback').mockReturnValue(Promise.resolve()),
		};

		service.login({ loginHint: 'login' });
		service.register({ loginHint: 'register' });
		service.refresh();
		service.revoke();
		service.logout({ postLogoutRedirectUri: 'uri' });
		service.handleCallback();

		expect(spies.login).toHaveBeenCalledWith({ loginHint: 'login' });
		expect(spies.register).toHaveBeenCalledWith({ loginHint: 'register' });
		expect(spies.refresh).toHaveBeenCalled();
		expect(spies.revoke).toHaveBeenCalled();
		expect(spies.logout).toHaveBeenCalledWith({ postLogoutRedirectUri: 'uri' });
		expect(spies.handleCallback).toHaveBeenCalled();
	});
});
