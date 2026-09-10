import type { ServerAdapter, ServerStorage, LogoutTokenClaims } from '../../../src/types';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createServerStateStorage, createServerMemoryStorage, createSessionIdCookieStorage, createEncryptedCookieStorage } from '../../../src/storages';
import { flushSetCookies } from '../../../src/utils';

type MockEvent = { request: Request };

const adapter: ServerAdapter<MockEvent> = {
	toRequest: (event) => event.request,
};

function createMockEvent(cookies: Record<string, string> = {}): MockEvent {
	const cookieHeader = Object.entries(cookies)
		.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
		.join('; ');
	const request = new Request('https://example.com');

	if (cookieHeader) {
		// `Request`'s constructor strips forbidden headers like `cookie`, so it must be set directly on the built request instead.
		request.headers.set('cookie', cookieHeader);
	}

	return { request };
}

// Reads the `Set-Cookie` headers accumulated for an event back into a plain name/value map.
function getSetCookies(event: MockEvent): Record<string, string> {
	const response = flushSetCookies(event, new Response());
	const cookies: Record<string, string> = {};

	for (const header of response.headers.getSetCookie()) {
		const [pair] = header.split(';');
		const index = pair.indexOf('=');

		cookies[pair.slice(0, index)] = decodeURIComponent(pair.slice(index + 1));
	}

	return cookies;
}

describe('createServerStateStorage', () => {
	test('should return null when the key does not exist', async () => {
		const storage = createServerStateStorage();

		await expect(storage.get('missing')).resolves.toBeNull();
	});

	test('should store and retrieve a value', async () => {
		const storage = createServerStateStorage();

		await storage.set('key', 'value');

		await expect(storage.get('key')).resolves.toBe('value');
	});

	test('should overwrite an existing value', async () => {
		const storage = createServerStateStorage();

		await storage.set('key', 'value');
		await storage.set('key', 'new-value');

		await expect(storage.get('key')).resolves.toBe('new-value');
	});

	test('should delete a stored value', async () => {
		const storage = createServerStateStorage();

		await storage.set('key', 'value');
		await storage.delete('key');

		await expect(storage.get('key')).resolves.toBeNull();
	});

	test('should share state across separate instances', async () => {
		const storageA = createServerStateStorage();
		const storageB = createServerStateStorage();

		await storageA.set('key', 'value');

		await expect(storageB.get('key')).resolves.toBe('value');
	});
});

describe('createServerMemoryStorage', () => {
	beforeEach(() => {
		delete (globalThis as { sty?: unknown }).sty;
	});

	test('should return null when the key does not exist', async () => {
		const storage = createServerMemoryStorage();

		await expect(storage.get('missing')).resolves.toBeNull();
	});

	test('should store and retrieve a value', async () => {
		const storage = createServerMemoryStorage();

		await storage.set('key', 'value');

		await expect(storage.get('key')).resolves.toBe('value');
	});

	test('should overwrite an existing value', async () => {
		const storage = createServerMemoryStorage();

		await storage.set('key', 'value');
		await storage.set('key', 'new-value');

		await expect(storage.get('key')).resolves.toBe('new-value');
	});

	test('should delete a stored value', async () => {
		const storage = createServerMemoryStorage();

		await storage.set('key', 'value');
		await storage.delete('key');

		await expect(storage.get('key')).resolves.toBeNull();
	});

	test('should reset the shared state whenever a new instance is created', async () => {
		const storageA = createServerMemoryStorage();

		await storageA.set('key', 'value');

		createServerMemoryStorage();

		await expect(storageA.get('key')).resolves.toBeNull();
	});

	test('should delete sessions matching the logout token sid', async () => {
		const storage = createServerMemoryStorage();

		await storage.set('session-a', JSON.stringify({ claims: { sid: 'sid-a' } }));
		await storage.set('session-b', JSON.stringify({ claims: { sid: 'sid-b' } }));

		await storage.deleteByLogoutToken!({ sid: 'sid-a' } as LogoutTokenClaims);

		await expect(storage.get('session-a')).resolves.toBeNull();
		await expect(storage.get('session-b')).resolves.not.toBeNull();
	});

	test('should delete sessions matching the logout token sub', async () => {
		const storage = createServerMemoryStorage();

		await storage.set('session-a', JSON.stringify({ claims: { sub: 'sub-a' } }));
		await storage.set('session-b', JSON.stringify({ claims: { sub: 'sub-b' } }));

		await storage.deleteByLogoutToken!({ sub: 'sub-a' } as LogoutTokenClaims);

		await expect(storage.get('session-a')).resolves.toBeNull();
		await expect(storage.get('session-b')).resolves.not.toBeNull();
	});

	test('should not delete sessions when the logout token matches nothing', async () => {
		const storage = createServerMemoryStorage();

		await storage.set('session-a', JSON.stringify({ claims: { sid: 'sid-a' } }));

		await storage.deleteByLogoutToken!({ sid: 'other-sid' } as LogoutTokenClaims);

		await expect(storage.get('session-a')).resolves.not.toBeNull();
	});
});

describe('createSessionIdCookieStorage', () => {
	type MockEvent = { request: Request };

	function createSessionAdapter(): ServerAdapter<MockEvent> {
		return { toRequest: (event) => event.request };
	}

	function createUnderlyingStorage(): ServerStorage<MockEvent> {
		return {
			get: vi.fn().mockResolvedValue(null),
			set: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			deleteByLogoutToken: vi.fn().mockResolvedValue(undefined),
		};
	}

	test('should return null and skip the underlying storage when no session id cookie exists', async () => {
		const underlying = createUnderlyingStorage();
		const storage = createSessionIdCookieStorage(createSessionAdapter(), underlying);

		await expect(storage.get('key', createMockEvent())).resolves.toBeNull();
		expect(underlying.get).not.toHaveBeenCalled();
	});

	test('should generate a new session id and set a cookie on first set', async () => {
		const underlying = createUnderlyingStorage();
		const storage = createSessionIdCookieStorage(createSessionAdapter(), underlying);
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);

		const cookies = getSetCookies(outgoingEvent);

		expect(cookies.key).toBeTruthy();
		expect(underlying.set).toHaveBeenCalledWith(cookies.key, 'value');
	});

	test('should use the custom uuidGenerator when generating a session id', async () => {
		const underlying = createUnderlyingStorage();
		const uuidGenerator = vi.fn().mockReturnValue('custom-uuid');
		const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID');
		const storage = createSessionIdCookieStorage(createSessionAdapter(), underlying, { uuidGenerator });
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);

		expect(uuidGenerator).toHaveBeenCalledTimes(1);
		expect(randomUUID).not.toHaveBeenCalled();
		expect(getSetCookies(outgoingEvent).key).toBe('custom-uuid');
		expect(underlying.set).toHaveBeenCalledWith('custom-uuid', 'value');

		randomUUID.mockRestore();
	});

	test('should reuse the existing session id on subsequent set calls', async () => {
		const underlying = createUnderlyingStorage();
		const storage = createSessionIdCookieStorage(createSessionAdapter(), underlying);
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);
		const sessionId = getSetCookies(outgoingEvent).key;

		const incomingEvent = createMockEvent({ key: sessionId });
		await storage.set('key', 'other-value', incomingEvent);

		expect(getSetCookies(incomingEvent).key).toBeUndefined();
		expect(underlying.set).toHaveBeenLastCalledWith(sessionId, 'other-value');
	});

	test('should retrieve the value from the underlying storage via the session id cookie', async () => {
		const underlying = createServerMemoryStorage();
		const storage = createSessionIdCookieStorage(createSessionAdapter(), underlying);
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);
		const incomingEvent = createMockEvent(getSetCookies(outgoingEvent));

		await expect(storage.get('key', incomingEvent)).resolves.toBe('value');
	});

	test('should delete the session from the underlying storage and expire the cookie', async () => {
		const underlying = createUnderlyingStorage();
		const storage = createSessionIdCookieStorage(createSessionAdapter(), underlying);
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);
		const sessionId = getSetCookies(outgoingEvent).key;

		const incomingEvent = createMockEvent({ key: sessionId });
		await storage.delete('key', incomingEvent);

		expect(underlying.delete).toHaveBeenCalledWith(sessionId);
		const [header] = flushSetCookies(incomingEvent, new Response()).headers.getSetCookie();

		expect(header).toContain('key=');
		expect(header).toContain('Expires=Thu, 01 Jan 1970');
	});

	test('should still expire the cookie when no session id exists on delete', async () => {
		const underlying = createUnderlyingStorage();
		const storage = createSessionIdCookieStorage(createSessionAdapter(), underlying);
		const event = createMockEvent();

		await storage.delete('key', event);

		expect(underlying.delete).not.toHaveBeenCalled();
		const [header] = flushSetCookies(event, new Response()).headers.getSetCookie();

		expect(header).toContain('Expires=Thu, 01 Jan 1970');
	});

	test('should apply the default and custom cookie attributes', async () => {
		const storage = createSessionIdCookieStorage(createSessionAdapter(), createUnderlyingStorage(), {
			defaultCookieOptions: { sameSite: 'strict', path: '/custom' },
		});
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);

		const [header] = flushSetCookies(outgoingEvent, new Response()).headers.getSetCookie();

		expect(header).toContain('Path=/custom');
		expect(header).toContain('SameSite=Strict');
		expect(header).toContain('HttpOnly');
		expect(header).toContain('Secure');
	});

	test('should delegate deleteByLogoutToken to the underlying storage', async () => {
		const underlying = createUnderlyingStorage();
		const storage = createSessionIdCookieStorage(createSessionAdapter(), underlying);
		const token = { sid: 'session-id' } as LogoutTokenClaims;

		await storage.deleteByLogoutToken!(token);

		expect(underlying.deleteByLogoutToken).toHaveBeenCalledWith(token);
	});

	test('should use a pre-existing adapter.getSessionId instead of the cookie-based default', async () => {
		const underlying = createUnderlyingStorage();
		const adapter = createSessionAdapter();
		adapter.getSessionId = vi.fn().mockResolvedValue('custom-session-id');

		const storage = createSessionIdCookieStorage(adapter, underlying);

		await expect(storage.get('key', createMockEvent())).resolves.toBeNull();
		expect(underlying.get).toHaveBeenCalledWith('custom-session-id');
	});
});

describe('createEncryptedCookieStorage', () => {
	const secret = 'test-secret';

	test('should return null when no event is provided', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);

		await expect(storage.get('key')).resolves.toBeNull();
	});

	test('should return null when the cookie is not present', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);

		await expect(storage.get('key', createMockEvent())).resolves.toBeNull();
	});

	test('should store and retrieve a value via cookies', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);

		const incomingEvent = createMockEvent(getSetCookies(outgoingEvent));

		await expect(storage.get('key', incomingEvent)).resolves.toBe('value');
	});

	test('should encrypt the cookie value', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'sensitive-value', outgoingEvent);

		expect(getSetCookies(outgoingEvent).key).not.toContain('sensitive-value');
	});

	test('should apply the default cookie attributes', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);

		const [header] = flushSetCookies(outgoingEvent, new Response()).headers.getSetCookie();

		expect(header).toContain('Path=/');
		expect(header).toContain('HttpOnly');
		expect(header).toContain('Secure');
		expect(header).toContain('SameSite=Lax');
	});

	test('should accept custom cookie options', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter, {
			defaultCookieOptions: { httpOnly: false, secure: false, sameSite: 'strict', path: '/custom' },
		});
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);

		const [header] = flushSetCookies(outgoingEvent, new Response()).headers.getSetCookie();

		expect(header).toContain('Path=/custom');
		expect(header).toContain('SameSite=Strict');
		expect(header).not.toContain('HttpOnly');
		expect(header).not.toContain('Secure');
	});

	test('should chunk values larger than the cookie size limit', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);
		const outgoingEvent = createMockEvent();
		const largeValue = 'a'.repeat(3000);

		await storage.set('key', largeValue, outgoingEvent);

		const cookies = getSetCookies(outgoingEvent);

		expect(cookies.key).toBe('');
		expect(cookies['key.0']).toBeDefined();
		expect(cookies['key.1']).toBeDefined();

		await expect(storage.get('key', createMockEvent(cookies))).resolves.toBe(largeValue);
	});

	test('should remove existing chunks when overwriting with a smaller value', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);
		const outgoingEvent = createMockEvent();
		const largeValue = 'a'.repeat(3000);

		await storage.set('key', largeValue, outgoingEvent);
		const incomingEvent = createMockEvent(getSetCookies(outgoingEvent));

		await storage.set('key', 'small-value', incomingEvent);
		const cookies = getSetCookies(incomingEvent);

		expect(cookies.key).toBeDefined();
		expect(cookies['key.0']).toBe('');
		expect(cookies['key.1']).toBe('');
	});

	test('should delete a stored cookie', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);
		const outgoingEvent = createMockEvent();

		await storage.delete('key', outgoingEvent);

		const [header] = flushSetCookies(outgoingEvent, new Response()).headers.getSetCookie();

		expect(header).toContain('key=');
		expect(header).toContain('Expires=Thu, 01 Jan 1970');
	});

	test('should return null after decrypting with a different secret', async () => {
		const storage = createEncryptedCookieStorage(secret, adapter);
		const outgoingEvent = createMockEvent();

		await storage.set('key', 'value', outgoingEvent);

		const otherStorage = createEncryptedCookieStorage('other-secret', adapter);
		const incomingEvent = createMockEvent(getSetCookies(outgoingEvent));

		await expect(otherStorage.get('key', incomingEvent)).resolves.toBeNull();
	});
});
