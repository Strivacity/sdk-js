import type { AngularServerSDK } from '../../../src/server/types';
import { ApplicationInitStatus, REQUEST, RESPONSE_INIT, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, test, expect, vi } from 'vitest';
import { pushSetCookie } from '@strivacity/sdk-core/utils';
import { SESSION_TRANSFER_KEY, provideStrivacityServerSession } from '../../../src/server/session';

function configure(request: Request | undefined, serverSdk: AngularServerSDK | undefined, responseInit?: ResponseInit) {
	TestBed.configureTestingModule({
		providers: [{ provide: REQUEST, useValue: request }, { provide: RESPONSE_INIT, useValue: responseInit ?? null }, provideStrivacityServerSession(serverSdk)],
	});

	return TestBed.inject(ApplicationInitStatus).donePromise;
}

describe('provideStrivacityServerSession', () => {
	test('loads the session for the incoming request and hands it over via TransferState', async () => {
		const request = new Request('https://brandtegrity.io');
		const session = { access_token: 'access-token' };
		const getSession = vi.fn().mockResolvedValue(session);

		await configure(request, { getSession: getSession } as unknown as AngularServerSDK);

		expect(getSession).toHaveBeenCalledWith(request);
		expect(TestBed.inject(TransferState).get(SESSION_TRANSFER_KEY, undefined)).toEqual(session);
	});

	test('never transfers the refresh token or the ID token to the client', async () => {
		const request = new Request('https://brandtegrity.io');
		const session = { access_token: 'access-token', refresh_token: 'refresh-token', id_token: 'id-token', expires_at: 9999999999, claims: { sub: 'user' } };
		const getSession = vi.fn().mockResolvedValue(session);

		await configure(request, { getSession: getSession } as unknown as AngularServerSDK);

		expect(TestBed.inject(TransferState).get(SESSION_TRANSFER_KEY, undefined)).toEqual({
			access_token: 'access-token',
			expires_at: 9999999999,
			claims: { sub: 'user' },
		});
	});

	test('refreshes a near-expiry session on the server and writes the rotated cookie to the rendered response', async () => {
		const request = new Request('https://brandtegrity.io/profile');
		const rotated = { access_token: 'new', refresh_token: 'refresh-2', id_token: 'id-2', expires_at: 9999999999, claims: { sub: 'user' } };
		const getSession = vi.fn().mockImplementation((req: Request) => {
			pushSetCookie(req, 'sty.session=rotated; Path=/');
			return Promise.resolve(rotated);
		});
		const responseInit: ResponseInit = { headers: { 'x-existing': '1' } };

		await configure(request, { getSession } as unknown as AngularServerSDK, responseInit);

		expect(getSession).toHaveBeenCalledWith(request);
		expect(TestBed.inject(TransferState).get(SESSION_TRANSFER_KEY, undefined)).toEqual({
			access_token: 'new',
			expires_at: 9999999999,
			claims: { sub: 'user' },
		});
		const headers = responseInit.headers as Headers;
		expect(headers.getSetCookie()).toEqual(['sty.session=rotated; Path=/']);
		expect(headers.get('x-existing')).toBe('1');
	});

	test('transfers null when the server-side refresh fails', async () => {
		const request = new Request('https://brandtegrity.io/profile');

		await configure(request, { getSession: vi.fn().mockResolvedValue(null) } as unknown as AngularServerSDK, {});

		expect(TestBed.inject(TransferState).get(SESSION_TRANSFER_KEY, undefined)).toBeNull();
	});

	test('transfers null when the server sdk finds no session for the request', async () => {
		const request = new Request('https://brandtegrity.io');
		const getSession = vi.fn().mockResolvedValue(null);

		await configure(request, { getSession: getSession } as unknown as AngularServerSDK);

		expect(TestBed.inject(TransferState).get(SESSION_TRANSFER_KEY, undefined)).toBeNull();
	});

	test('is a no-op when there is no incoming request (e.g. not running under SSR)', async () => {
		const getSession = vi.fn().mockResolvedValue({ access_token: 'access-token' });

		await configure(undefined, { getSession: getSession } as unknown as AngularServerSDK);

		expect(getSession).not.toHaveBeenCalled();
		expect(TestBed.inject(TransferState).hasKey(SESSION_TRANSFER_KEY)).toBe(false);
	});

	test('is a no-op when no server sdk was configured (serverSessionUri unset)', async () => {
		const request = new Request('https://brandtegrity.io');

		await configure(request, undefined);

		expect(TestBed.inject(TransferState).hasKey(SESSION_TRANSFER_KEY)).toBe(false);
	});
});
