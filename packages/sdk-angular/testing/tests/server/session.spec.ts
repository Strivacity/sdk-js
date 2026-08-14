import type { AngularServerSDK } from '../../../src/server/types';
import { ApplicationInitStatus, REQUEST, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, test, expect, vi } from 'vitest';
import { SESSION_TRANSFER_KEY, provideStrivacityServerSession } from '../../../src/server/session';

function configure(request: Request | undefined, serverSdk: AngularServerSDK | undefined) {
	TestBed.configureTestingModule({
		providers: [{ provide: REQUEST, useValue: request }, provideStrivacityServerSession(serverSdk)],
	});

	return TestBed.inject(ApplicationInitStatus).donePromise;
}

describe('provideStrivacityServerSession', () => {
	test('loads the session for the incoming request and hands it over via TransferState', async () => {
		const request = new Request('https://brandtegrity.io');
		const session = { access_token: 'access-token' };
		const getSession = vi.fn().mockResolvedValue(session);

		await configure(request, { getSession } as unknown as AngularServerSDK);

		expect(getSession).toHaveBeenCalledWith(request);
		expect(TestBed.inject(TransferState).get(SESSION_TRANSFER_KEY, undefined)).toEqual(session);
	});

	test('transfers null when the server sdk finds no session for the request', async () => {
		const request = new Request('https://brandtegrity.io');
		const getSession = vi.fn().mockResolvedValue(null);

		await configure(request, { getSession } as unknown as AngularServerSDK);

		expect(TestBed.inject(TransferState).get(SESSION_TRANSFER_KEY, undefined)).toBeNull();
	});

	test('is a no-op when there is no incoming request (e.g. not running under SSR)', async () => {
		const getSession = vi.fn().mockResolvedValue({ access_token: 'access-token' });

		await configure(undefined, { getSession } as unknown as AngularServerSDK);

		expect(getSession).not.toHaveBeenCalled();
		expect(TestBed.inject(TransferState).hasKey(SESSION_TRANSFER_KEY)).toBe(false);
	});

	test('is a no-op when no server sdk was configured (serverSessionUri unset)', async () => {
		const request = new Request('https://brandtegrity.io');

		await configure(request, undefined);

		expect(TestBed.inject(TransferState).hasKey(SESSION_TRANSFER_KEY)).toBe(false);
	});
});
