import { describe, test, expect } from 'vitest';
import { appendReturnTo } from '../../../src/utils/path';

describe('appendReturnTo', () => {
	test('adds the given returnTo, choosing the right separator', () => {
		expect(appendReturnTo('/login', '/orders?page=2')).toBe('/login?returnTo=%2Forders%3Fpage%3D2');
		expect(appendReturnTo('/login?prompt=login', '/orders')).toBe('/login?prompt=login&returnTo=%2Forders');
	});

	test('defaults to the current path, query and hash', () => {
		const { pathname, search, hash } = globalThis.location;

		expect(appendReturnTo('/login')).toBe(`/login?returnTo=${encodeURIComponent(`${pathname}${search}${hash}`)}`);
	});

	test('keeps an existing returnTo', () => {
		expect(appendReturnTo('/login?returnTo=%2Fhome', '/orders')).toBe('/login?returnTo=%2Fhome');
	});
});
