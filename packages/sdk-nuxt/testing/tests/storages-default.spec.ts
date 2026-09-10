import { describe, test, expect } from 'vitest';
import { createEncryptedCookieStorage, createSessionIdCookieStorage } from '../../src/runtime/storages/default';
import { createServerMemoryStorage } from '@strivacity/sdk-core/storages';
import { flushSetCookies } from '@strivacity/sdk-core/utils';
import { createFakeH3Event, getResponseCookies } from '../utils/http';

function extractCookieHeader(cookies: Array<string>): string {
	return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('createEncryptedCookieStorage', () => {
	test('returns null for a key with no cookie at all', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const event = createFakeH3Event();

		await expect(storage.get('sty.session', event)).resolves.toBeNull();
	});

	test('returns null/undefined and is a no-op when no event is provided to get/set/delete', async () => {
		const storage = createEncryptedCookieStorage('secret');

		await expect(storage.get('sty.session', undefined)).resolves.toBeNull();
		await expect(storage.set('sty.session', 'value', undefined)).resolves.toBeUndefined();
		await expect(storage.delete('sty.session', undefined)).resolves.toBeUndefined();
	});

	test('round-trips a small value through a single encrypted cookie', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const outgoing = createFakeH3Event();

		await storage.set('sty.session', 'small-value', outgoing);

		const cookies = getResponseCookies(outgoing);
		expect(cookies).toHaveLength(1);
		expect(cookies[0]).toContain('sty.session=');

		const incoming = createFakeH3Event(extractCookieHeader(cookies));

		await expect(storage.get('sty.session', incoming)).resolves.toBe('small-value');
	});

	test('chunks a value larger than the cookie chunk size across multiple numbered cookies and reassembles it on read', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const outgoing = createFakeH3Event();
		const largeValue = 'x'.repeat(10_000);

		await storage.set('sty.session', largeValue, outgoing);

		const cookies = getResponseCookies(outgoing);
		expect(cookies.length).toBeGreaterThan(1);
		expect(cookies.some((cookie) => cookie.startsWith('sty.session.0='))).toBe(true);
		// set() always clears the base "sty.session" cookie first (via deleteCookie), so a Max-Age=0
		// expiry for it is expected here; it must not carry an actual value alongside the chunks.
		expect(cookies.some((cookie) => cookie.startsWith('sty.session=') && cookie.includes('Max-Age=0'))).toBe(true);

		const incoming = createFakeH3Event(extractCookieHeader(cookies));

		await expect(storage.get('sty.session', incoming)).resolves.toBe(largeValue);
	});

	test('first clears any previously set chunk cookie(s) for the key before writing a smaller value (avoids leaving stale chunks behind)', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const first = createFakeH3Event();

		await storage.set('sty.session', 'x'.repeat(10_000), first);

		// deleteCookie/setCookie only ever see the *incoming request's* cookies, so detecting (and
		// clearing) the previous chunk cookies requires a fresh event carrying them as a real
		// round-trip would - a second set() on the very same (response-only) event never can.
		const second = createFakeH3Event(extractCookieHeader(getResponseCookies(first)));
		await storage.set('sty.session', 'small-value-again', second);

		const cookies = getResponseCookies(second);
		const chunkCookies = cookies.filter((cookie) => cookie.startsWith('sty.session.'));
		expect(chunkCookies.length).toBeGreaterThan(0);
		expect(chunkCookies.every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);

		const incoming = createFakeH3Event(extractCookieHeader(cookies));
		await expect(storage.get('sty.session', incoming)).resolves.toBe('small-value-again');
	});

	test('deletes the unchunked cookie and every numbered chunk cookie present on the incoming request', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const outgoing = createFakeH3Event();
		await storage.set('sty.session', 'x'.repeat(10_000), outgoing);

		// simulate the browser round-tripping the chunk cookies back on the delete request
		const deleteEvent = createFakeH3Event(extractCookieHeader(getResponseCookies(outgoing)));
		await storage.delete('sty.session', deleteEvent);

		const expiredCookies = getResponseCookies(deleteEvent);
		expect(expiredCookies.some((cookie) => cookie.startsWith('sty.session=') && cookie.includes('Max-Age=0'))).toBe(true);
		expect(expiredCookies.some((cookie) => cookie.startsWith('sty.session.0=') && cookie.includes('Max-Age=0'))).toBe(true);
		expect(expiredCookies.some((cookie) => cookie.startsWith('sty.session.1=') && cookie.includes('Max-Age=0'))).toBe(true);
	});

	test('deleting a key with no cookie at all still just expires the base cookie, without throwing', async () => {
		const storage = createEncryptedCookieStorage('secret');
		const event = createFakeH3Event();

		await expect(storage.delete('sty.session', event)).resolves.toBeUndefined();
		expect(getResponseCookies(event)[0]).toContain('Max-Age=0');
	});

	test('applies default cookie attributes (httpOnly, secure, lax) and honors overrides', async () => {
		const defaultStorage = createEncryptedCookieStorage('secret');
		const defaultEvent = createFakeH3Event();
		await defaultStorage.set('sty.session', 'value', defaultEvent);
		const [defaultCookie] = getResponseCookies(defaultEvent);

		expect(defaultCookie).toContain('HttpOnly');
		expect(defaultCookie).toContain('Secure');
		expect(defaultCookie).toContain('SameSite=Lax');
		expect(defaultCookie).toContain('Path=/');

		const customStorage = createEncryptedCookieStorage('secret', { defaultCookieOptions: { sameSite: 'strict', maxAge: 60 } });
		const customEvent = createFakeH3Event();
		await customStorage.set('sty.session', 'value', customEvent);
		const [customCookie] = getResponseCookies(customEvent);

		expect(customCookie).toContain('SameSite=Strict');
		expect(customCookie).toContain('Max-Age=60');
	});
});

describe('createSessionIdCookieStorage', () => {
	test('adapts the H3Event into a Request for the underlying core session-id cookie storage, round-tripping get/set through it', async () => {
		const underlying = createServerMemoryStorage();
		const storage = createSessionIdCookieStorage(underlying);
		const outgoing = createFakeH3Event();

		await storage.set('key', 'value', outgoing);

		// createSessionIdCookieStorage (core) queues its Set-Cookie header in an internal cookie jar
		// keyed by the event object, rather than writing through h3's response headers the way
		// createEncryptedCookieStorage does - flushSetCookies() is how it's meant to be drained.
		const response = flushSetCookies(outgoing, new Response());
		const setCookie = response.headers.get('set-cookie');
		expect(setCookie).toBeTruthy();

		const incoming = createFakeH3Event(setCookie!.split(';')[0]);

		await expect(storage.get('key', incoming)).resolves.toBe('value');
	});

	test('returns null when the incoming event carries no session-id cookie', async () => {
		const storage = createSessionIdCookieStorage(createServerMemoryStorage());

		await expect(storage.get('key', createFakeH3Event())).resolves.toBeNull();
	});
});
