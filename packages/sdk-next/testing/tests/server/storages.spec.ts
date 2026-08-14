import type { Mock } from 'vitest';
import { describe, test, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { flushSetCookies } from '@strivacity/sdk-core/utils/server';
import { InternalError } from '@strivacity/sdk-core/utils/errors';
import { decryptString } from '@strivacity/sdk-core/utils/crypto';
import { createMockStorage } from '@strivacity/testing/mocks/sdk';
import { createSessionIdCookieStorage, createEncryptedCookieStorage } from '../../../src/server/storages';
import type { NextServerStorage } from '../../../src/server/types';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

type FakeCookieJar = { get: Mock; set: Mock; delete: Mock };

function createFakeCookieJar(): FakeCookieJar {
	const store = new Map<string, string>();

	return {
		get: vi.fn((name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined)),
		set: vi.fn((name: string, value: string) => {
			store.set(name, value);
		}),
		delete: vi.fn((name: string) => {
			store.delete(name);
		}),
	};
}

function createFakePagesResponse() {
	const headers = new Map<string, string | Array<string>>();

	return {
		getHeader: vi.fn((name: string) => headers.get(name)),
		setHeader: vi.fn((name: string, value: string | Array<string>) => {
			headers.set(name, value);
		}),
	};
}

describe('createSessionIdCookieStorage', () => {
	test('get returns null when there is no session-id cookie on a NextRequest', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		const storage = createSessionIdCookieStorage(inner);

		await expect(storage.get('sty.session', new NextRequest('https://brandtegrity.io'))).resolves.toBeNull();
	});

	test('get resolves the inner storage entry addressed by the session-id cookie on a NextRequest', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		await inner.set('session-id-1', 'serialized-data');
		const storage = createSessionIdCookieStorage(inner);
		const req = new NextRequest('https://brandtegrity.io');
		req.cookies.set('sty.session', 'session-id-1');

		await expect(storage.get('sty.session', req)).resolves.toBe('serialized-data');
	});

	test('get resolves the inner storage entry addressed by the session-id cookie on a plain Request', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		await inner.set('session-id-2', 'serialized-data');
		const storage = createSessionIdCookieStorage(inner);
		const req = new Request('https://brandtegrity.io');
		req.headers.set('cookie', 'sty.session=session-id-2');

		await expect(storage.get('sty.session', req)).resolves.toBe('serialized-data');
	});

	test('get resolves the inner storage entry addressed by the session-id cookie on a Pages Router request', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		await inner.set('session-id-3', 'serialized-data');
		const storage = createSessionIdCookieStorage(inner);

		await expect(storage.get('sty.session', { headers: { cookie: 'sty.session=session-id-3' } } as never)).resolves.toBe('serialized-data');
	});

	test('get falls back to next/headers cookies() when no request is given', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		await inner.set('session-id-4', 'serialized-data');
		const jar = createFakeCookieJar();
		jar.set('sty.session', 'session-id-4');
		vi.mocked(cookies).mockResolvedValue(jar as never);
		const storage = createSessionIdCookieStorage(inner);

		await expect(storage.get('sty.session')).resolves.toBe('serialized-data');
	});

	test('get resolves null through the cookies() fallback when there is no session-id cookie', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		vi.mocked(cookies).mockResolvedValue(createFakeCookieJar() as never);
		const storage = createSessionIdCookieStorage(inner);

		await expect(storage.get('sty.session')).resolves.toBeNull();
	});

	test('set generates a new session-id and pushes it as an outgoing cookie when none exists yet', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		const storage = createSessionIdCookieStorage(inner);
		const req = new NextRequest('https://brandtegrity.io');

		await storage.set('sty.session', 'serialized-data', req);

		expect(inner.set).toHaveBeenCalledWith(expect.any(String), 'serialized-data');

		const response = flushSetCookies(req, new Response());
		expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith('sty.session='))).toBe(true);
	});

	test('set reuses an existing session-id from the request without pushing a new cookie', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		const storage = createSessionIdCookieStorage(inner);
		const req = new NextRequest('https://brandtegrity.io');
		req.cookies.set('sty.session', 'existing-id');

		await storage.set('sty.session', 'serialized-data', req);

		expect(inner.set).toHaveBeenCalledWith('existing-id', 'serialized-data');
		expect(flushSetCookies(req, new Response()).headers.getSetCookie()).toHaveLength(0);
	});

	test('set reuses an existing session-id found through the cookies() fallback with no request', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		const jar = createFakeCookieJar();
		jar.set('sty.session', 'existing-id');
		vi.mocked(cookies).mockResolvedValue(jar as never);
		const storage = createSessionIdCookieStorage(inner);

		await storage.set('sty.session', 'serialized-data');

		expect(inner.set).toHaveBeenCalledWith('existing-id', 'serialized-data');
	});

	test('set throws when no request is given and no session-id cookie exists yet to attach the new one to', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		vi.mocked(cookies).mockResolvedValue(createFakeCookieJar() as never);
		const storage = createSessionIdCookieStorage(inner);

		await expect(storage.set('sty.session', 'serialized-data')).rejects.toThrow(InternalError);
	});

	test('delete removes the inner storage entry and expires the session-id cookie', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		await inner.set('session-id-5', 'serialized-data');
		const storage = createSessionIdCookieStorage(inner);
		const req = new NextRequest('https://brandtegrity.io');
		req.cookies.set('sty.session', 'session-id-5');

		await storage.delete('sty.session', req);

		expect(inner.delete).toHaveBeenCalledWith('session-id-5');
		const setCookies = flushSetCookies(req, new Response()).headers.getSetCookie();
		expect(setCookies.some((cookie) => cookie.startsWith('sty.session=') && cookie.includes('Expires=Thu, 01 Jan 1970'))).toBe(true);
	});

	test('delete always throws when no request is given, since expiring the cookie requires a request-scoped event', async () => {
		const inner = createMockStorage() as unknown as NextServerStorage;
		vi.mocked(cookies).mockResolvedValue(createFakeCookieJar() as never);
		const storage = createSessionIdCookieStorage(inner);

		await expect(storage.delete('sty.session')).rejects.toThrow(InternalError);
	});
});

describe('createEncryptedCookieStorage', () => {
	test('get resolves null when there is no cookie at all', async () => {
		const storage = createEncryptedCookieStorage('secret');

		await expect(storage.get('sty.session', new NextRequest('https://brandtegrity.io'))).resolves.toBeNull();
	});

	test('set/get round-trip a short value through an explicit NextRequest/NextResponse pair', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = NextResponse.next();

		await storage.set('sty.session', 'hello world', undefined, res);

		const cookie = res.cookies.get('sty.session');
		expect(cookie).toBeDefined();

		const req = new NextRequest('https://brandtegrity.io');
		req.cookies.set('sty.session', cookie!.value);

		await expect(storage.get('sty.session', req)).resolves.toBe('hello world');
	});

	test('set applies the given cookie options on top of the secure defaults', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = NextResponse.next();

		await storage.set('sty.session', 'hello world', undefined, res, { maxAge: 60 });

		const cookie = res.cookies.get('sty.session');
		expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 });
	});

	test('delete expires the cookie on an explicit NextResponse', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = NextResponse.next();
		await storage.set('sty.session', 'hello world', undefined, res);

		await storage.delete('sty.session', undefined, res);

		expect(res.cookies.get('sty.session')?.value).toBe('');
	});

	test('set/get round-trip a short value through a plain Request and a Pages Router response', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = createFakePagesResponse();

		await storage.set('sty.session', 'hello world', undefined, res as never);

		// NOTE: set() first deletes any existing cookie(s) as cleanup, leaving an empty-valued placeholder alongside the real, non-empty cookie.
		const lastCall = (res.setHeader as Mock).mock.calls.at(-1) as [string, Array<string>];
		const setCookieHeader = lastCall[1].find(
			(cookie) => cookie.startsWith('sty.session=') && cookie.slice('sty.session='.length, cookie.indexOf(';')).length > 0,
		)!;
		const rawValue = setCookieHeader.slice('sty.session='.length, setCookieHeader.indexOf(';'));

		const req = new Request('https://brandtegrity.io');
		req.headers.set('cookie', `sty.session=${rawValue}`);

		await expect(storage.get('sty.session', req)).resolves.toBe('hello world');
	});

	test('delete appends a cleared set-cookie header to a Pages Router response', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = createFakePagesResponse();

		await storage.delete('sty.session', undefined, res as never);

		// NOTE: the plain-response branch builds the cookie via `buildCookieString`, whose `Max-Age` is only emitted when truthy - `maxAge: 0` is falsy,
		// so unlike the NextResponse branch (which uses `res.cookies.delete()`), this leaves neither `Max-Age` nor `Expires` on the cleared cookie.
		expect(res.setHeader).toHaveBeenCalledWith('set-cookie', ['sty.session=; HttpOnly; Secure; Path=/; SameSite=lax']);
	});

	test('merges a new cookie alongside a pre-existing single set-cookie header string on a Pages Router response', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = createFakePagesResponse();
		res.setHeader('set-cookie', 'other=1; Path=/');

		await storage.set('sty.session', 'hello world', undefined, res as never);

		const lastCall = (res.setHeader as Mock).mock.calls.at(-1) as [string, Array<string>];
		expect(lastCall[1]).toContain('other=1; Path=/');
		expect(lastCall[1].some((cookie) => cookie.startsWith('sty.session=') && cookie.slice('sty.session='.length, cookie.indexOf(';')).length > 0)).toBe(true);
	});

	test('merges an expiring cookie alongside a pre-existing single set-cookie header string on delete', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = createFakePagesResponse();
		res.setHeader('set-cookie', 'other=1; Path=/');

		await storage.delete('sty.session', undefined, res as never);

		expect((res.setHeader as Mock).mock.calls.at(-1)![1]).toEqual(['other=1; Path=/', 'sty.session=; HttpOnly; Secure; Path=/; SameSite=lax']);
	});

	test('set/delete branch on the response, not the request: given a request but no response, they still use the cookies() fallback', async () => {
		const jar = createFakeCookieJar();
		vi.mocked(cookies).mockResolvedValue(jar as never);
		const storage = createEncryptedCookieStorage('secret');

		await storage.set('sty.session', 'hello world', new NextRequest('https://brandtegrity.io'));

		expect(jar.set).toHaveBeenCalled();
		await expect(storage.get('sty.session')).resolves.toBe('hello world');
	});

	test('set/get/delete round-trip a value through the cookies() fallback when no request/response is given', async () => {
		const jar = createFakeCookieJar();
		vi.mocked(cookies).mockResolvedValue(jar as never);
		const storage = createEncryptedCookieStorage('secret');

		await storage.set('sty.session', 'hello world');

		await expect(storage.get('sty.session')).resolves.toBe('hello world');

		await storage.delete('sty.session');

		await expect(storage.get('sty.session')).resolves.toBeNull();
	});

	test('set splits a large value into chunk cookies once it exceeds COOKIE_CHUNK_SIZE, and get reassembles them', async () => {
		const jar = createFakeCookieJar();
		vi.mocked(cookies).mockResolvedValue(jar as never);
		const storage = createEncryptedCookieStorage('secret');
		const largeValue = 'x'.repeat(5000);

		await storage.set('sty.session', largeValue);

		expect(jar.get('sty.session')).toBeUndefined();
		expect(jar.get('sty.session.0')).toBeDefined();
		expect(jar.get('sty.session.1')).toBeDefined();

		await expect(storage.get('sty.session')).resolves.toBe(largeValue);
	});

	test('delete removes every chunk cookie left over from a chunked value', async () => {
		const jar = createFakeCookieJar();
		vi.mocked(cookies).mockResolvedValue(jar as never);
		const storage = createEncryptedCookieStorage('secret');

		await storage.set('sty.session', 'x'.repeat(5000));
		await storage.delete('sty.session');

		expect(jar.get('sty.session.0')).toBeUndefined();
		expect(jar.get('sty.session.1')).toBeUndefined();
		await expect(storage.get('sty.session')).resolves.toBeNull();
	});

	test('set splits a large value into chunk cookies on an explicit NextResponse, and get reassembles them from a NextRequest', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = NextResponse.next();
		const largeValue = 'y'.repeat(5000);

		await storage.set('sty.session', largeValue, undefined, res);

		// NOTE: set() first deletes the plain (non-chunked) key as cleanup; NextResponse.cookies.delete() leaves an emptied entry rather than removing it.
		expect(res.cookies.get('sty.session')?.value).toBe('');
		const chunk0 = res.cookies.get('sty.session.0');
		const chunk1 = res.cookies.get('sty.session.1');
		expect(chunk0).toBeDefined();
		expect(chunk1).toBeDefined();

		const req = new NextRequest('https://brandtegrity.io');
		req.cookies.set('sty.session.0', chunk0!.value);
		req.cookies.set('sty.session.1', chunk1!.value);

		await expect(storage.get('sty.session', req)).resolves.toBe(largeValue);
	});

	test('delete removes every chunk cookie on an explicit NextResponse', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const res = NextResponse.next();
		await storage.set('sty.session', 'z'.repeat(5000), undefined, res);

		await storage.delete('sty.session', undefined, res);

		expect(res.cookies.get('sty.session.0')?.value).toBe('');
		expect(res.cookies.get('sty.session.1')?.value).toBe('');
	});

	test('decrypted cookie value matches encryptString/decryptString used directly with the same secret', async () => {
		const secret = 'shared-secret';
		const storage = createEncryptedCookieStorage(secret);
		const res = NextResponse.next();

		await storage.set('sty.session', 'hello world', undefined, res);

		const cookie = res.cookies.get('sty.session')!;
		await expect(decryptString(cookie.value, secret, 'strivacity-session-v1')).resolves.toBe('hello world');
	});
});
