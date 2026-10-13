import { describe, test, expect, vi, afterEach } from 'vitest';
import type { SessionData } from '../../../src/types/oidc';
import { isSessionExpired } from '../../../src/utils/session';

describe('isSessionExpired', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test('returns true for a null session', () => {
		expect(isSessionExpired(null)).toBe(true);
	});

	test('returns true for an undefined session', () => {
		expect(isSessionExpired(undefined)).toBe(true);
	});

	test('returns true when access_token is missing', () => {
		expect(isSessionExpired({ expires_at: Math.floor(Date.now() / 1000) + 3600 })).toBe(true);
	});

	test('returns true when expires_at is missing', () => {
		expect(isSessionExpired({ access_token: 'token' })).toBe(true);
	});

	test('returns true when expires_at is in the past', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		const now = Math.floor(Date.now() / 1000);

		expect(isSessionExpired({ access_token: 'token', expires_at: now - 1 })).toBe(true);
	});

	test('returns true when expires_at equals the current time', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		const now = Math.floor(Date.now() / 1000);

		expect(isSessionExpired({ access_token: 'token', expires_at: now })).toBe(true);
	});

	test('returns false when expires_at is in the future and no skew is given', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		const now = Math.floor(Date.now() / 1000);

		expect(isSessionExpired({ access_token: 'token', expires_at: now + 3600 })).toBe(false);
	});

	test('treats the session as expired once inside the skew window before actual expiration', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		const now = Math.floor(Date.now() / 1000);

		expect(isSessionExpired({ access_token: 'token', expires_at: now + 30 }, 60)).toBe(true);
	});

	test('does not treat the session as expired outside the skew window', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		const now = Math.floor(Date.now() / 1000);

		expect(isSessionExpired({ access_token: 'token', expires_at: now + 120 }, 60)).toBe(false);
	});

	test('treats the session as expired exactly at the skew boundary', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		const now = Math.floor(Date.now() / 1000);

		expect(isSessionExpired({ access_token: 'token', expires_at: now + 60 }, 60)).toBe(true);
	});

	test('ignores a negative skew, only treating the session as expired after actual expiration', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		const now = Math.floor(Date.now() / 1000);

		expect(isSessionExpired({ access_token: 'token', expires_at: now + 30 }, -60)).toBe(false);
	});
});

describe('isSessionExpired skew cap', () => {
	test('caps the skew at half of the token lifetime, so a short-lived token is not expired as soon as it is issued', () => {
		const now = Math.floor(Date.now() / 1000);
		const session = { access_token: 'a', expires_in: 30, expires_at: now + 30 } as SessionData;

		expect(isSessionExpired(session, 60)).toBe(false);
		expect(isSessionExpired({ ...session, expires_at: now + 10 }, 60)).toBe(true);
	});

	test('applies the full skew when the lifetime is unknown or long enough', () => {
		const now = Math.floor(Date.now() / 1000);

		expect(isSessionExpired({ access_token: 'a', expires_at: now + 30 }, 60)).toBe(true);
		expect(isSessionExpired({ access_token: 'a', expires_in: 3600, expires_at: now + 30 }, 60)).toBe(true);
	});
});
