import { describe, test, expect, vi, afterEach } from 'vitest';
import { timestamp, unflattenObject, buildCookieString } from '../../../src/utils/common';

describe('timestamp', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test('returns the current time in whole seconds', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		expect(timestamp()).toBe(Math.floor(new Date('2030-01-01T00:00:00.000Z').getTime() / 1000));
	});
});

describe('unflattenObject', () => {
	test('returns an empty object for an empty input', () => {
		expect(unflattenObject({})).toEqual({});
	});

	test('unflattens a single-level dot-separated key', () => {
		expect(unflattenObject({ 'a.b': 1 })).toEqual({ a: { b: 1 } });
	});

	test('unflattens multiple nested levels', () => {
		expect(unflattenObject({ 'a.b.c': 1 })).toEqual({ a: { b: { c: 1 } } });
	});

	test('merges sibling keys under the same parent', () => {
		expect(unflattenObject({ 'a.b': 1, 'a.c': 2 })).toEqual({ a: { b: 1, c: 2 } });
	});

	test('keeps keys without dots at the top level', () => {
		expect(unflattenObject({ foo: 'bar' })).toEqual({ foo: 'bar' });
	});
});

describe('buildCookieString', () => {
	test('includes HttpOnly and Secure by default', () => {
		expect(buildCookieString('foo', 'bar', {})).toBe('foo=bar; HttpOnly; Secure; Path=/');
	});

	test('URI-encodes the cookie value', () => {
		expect(buildCookieString('foo', 'hello world', {})).toBe('foo=hello%20world; HttpOnly; Secure; Path=/');
	});

	test('omits HttpOnly when explicitly false', () => {
		expect(buildCookieString('foo', 'bar', { httpOnly: false })).toBe('foo=bar; Secure; Path=/');
	});

	test('omits Secure when explicitly false', () => {
		expect(buildCookieString('foo', 'bar', { secure: false })).toBe('foo=bar; HttpOnly; Path=/');
	});

	test('uses a custom path', () => {
		expect(buildCookieString('foo', 'bar', { path: '/auth' })).toBe('foo=bar; HttpOnly; Secure; Path=/auth');
	});

	test('includes SameSite when provided', () => {
		expect(buildCookieString('foo', 'bar', { sameSite: 'lax' })).toBe('foo=bar; HttpOnly; Secure; Path=/; SameSite=lax');
	});

	test('includes Max-Age when provided', () => {
		expect(buildCookieString('foo', 'bar', { maxAge: 3600 })).toBe('foo=bar; HttpOnly; Secure; Path=/; Max-Age=3600');
	});

	test('includes Domain when provided', () => {
		expect(buildCookieString('foo', 'bar', { domain: 'brandtegrity.io' })).toBe('foo=bar; HttpOnly; Secure; Path=/; Domain=brandtegrity.io');
	});

	test('combines all attributes', () => {
		expect(buildCookieString('foo', 'bar', { path: '/auth', sameSite: 'strict', maxAge: 60, domain: 'brandtegrity.io' })).toBe(
			'foo=bar; HttpOnly; Secure; Path=/auth; SameSite=strict; Max-Age=60; Domain=brandtegrity.io',
		);
	});
});
