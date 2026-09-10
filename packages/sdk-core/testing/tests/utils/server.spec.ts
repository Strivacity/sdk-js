import { describe, test, expect } from 'vitest';
import { serverAdapter, createHttpResponse, createMockStorage, createServerOptions } from '@strivacity/testing/mocks/sdk';
import {
	getServerSDKOptions,
	parseCookieHeader,
	serializeCookie,
	pushSetCookie,
	flushSetCookies,
	proxyResponse,
	toSafeRedirect,
	DEFAULT_COOKIE_MAX_AGE,
	ConfigurationError,
	InternalError,
} from '../../../src/utils';

describe('getServerSDKOptions', () => {
	test('w/o options', async () => {
		const options = getServerSDKOptions(serverAdapter, createServerOptions({ secret: 'secret' }));

		expect(options.storage.get).toBeInstanceOf(Function);
		expect(options.storage.set).toBeInstanceOf(Function);
		expect(options.storage.delete).toBeInstanceOf(Function);
		expect(options.postLoginRedirectUri).toBe('https://brandtegrity.io');
		expect(options.postLogoutRedirectUri).toBe('https://brandtegrity.io');
		expect(options.cookieMaxAge).toBe(DEFAULT_COOKIE_MAX_AGE);
		expect(options.authUrlPrefix).toBe('/auth');
		expect(options.loginUri).toBe('/login');
		expect(options.serverSessionUri).toBe('/auth/login');
		await expect(options.urlHandler(new URL('https://brandtegrity.io'))).resolves.toBeUndefined();
	});

	test('w/ options', () => {
		const storage = createMockStorage();
		const options = getServerSDKOptions(
			serverAdapter,
			createServerOptions({
				storage,
				cookieMaxAge: 60,
				postLoginRedirectUri: 'https://brandtegrity.io/home',
				postLogoutRedirectUri: 'https://brandtegrity.io/bye',
				authUrlPrefix: '/custom-auth',
			}),
		);

		expect(options.storage).toBe(storage);
		expect(options.postLoginRedirectUri).toBe('https://brandtegrity.io/home');
		expect(options.postLogoutRedirectUri).toBe('https://brandtegrity.io/bye');
		expect(options.cookieMaxAge).toBe(60);
		expect(options.serverSessionUri).toBe('/custom-auth/login');
	});

	test('throws a ConfigurationError when neither storage nor secret is provided', () => {
		expect(() => getServerSDKOptions(serverAdapter, createServerOptions({ secret: undefined }))).toThrow(new ConfigurationError('Missing SDK option: secret'));
	});
});

describe('parseCookieHeader', () => {
	test('returns an empty object when the header is missing', () => {
		expect(parseCookieHeader(null)).toEqual({});
		expect(parseCookieHeader(undefined)).toEqual({});
		expect(parseCookieHeader('')).toEqual({});
	});

	test('parses a single cookie', () => {
		expect(parseCookieHeader('foo=bar')).toEqual({ foo: 'bar' });
	});

	test('parses multiple cookies separated by "; "', () => {
		expect(parseCookieHeader('foo=bar; baz=qux')).toEqual({ foo: 'bar', baz: 'qux' });
	});

	test('decodes URI-encoded cookie values', () => {
		expect(parseCookieHeader('foo=hello%20world')).toEqual({ foo: 'hello world' });
	});

	test('falls back to the raw value when it cannot be URI-decoded', () => {
		expect(parseCookieHeader('foo=100%')).toEqual({ foo: '100%' });
	});

	test('ignores segments without an "=" separator', () => {
		expect(parseCookieHeader('foo=bar; malformed')).toEqual({ foo: 'bar' });
	});

	test('ignores segments with an empty name', () => {
		expect(parseCookieHeader('=value; foo=bar')).toEqual({ foo: 'bar' });
	});
});

describe('serializeCookie', () => {
	test('serializes name/value with the default path', () => {
		expect(serializeCookie('foo', 'bar')).toBe('foo=bar; Path=/');
	});

	test('URI-encodes the cookie value', () => {
		expect(serializeCookie('foo', 'hello world')).toBe('foo=hello%20world; Path=/');
	});

	test('includes Max-Age when provided', () => {
		expect(serializeCookie('foo', 'bar', { maxAge: 3600.9 })).toBe('foo=bar; Max-Age=3600; Path=/');
	});

	test('includes Expires when provided', () => {
		const expires = new Date('2030-01-01T00:00:00.000Z');

		expect(serializeCookie('foo', 'bar', { expires })).toBe(`foo=bar; Expires=${expires.toUTCString()}; Path=/`);
	});

	test('includes a custom path', () => {
		expect(serializeCookie('foo', 'bar', { path: '/auth' })).toBe('foo=bar; Path=/auth');
	});

	test('includes Domain when provided', () => {
		expect(serializeCookie('foo', 'bar', { domain: 'brandtegrity.io' })).toBe('foo=bar; Path=/; Domain=brandtegrity.io');
	});

	test('capitalizes the SameSite attribute', () => {
		expect(serializeCookie('foo', 'bar', { sameSite: 'strict' })).toBe('foo=bar; Path=/; SameSite=Strict');
	});

	test('includes Secure when true', () => {
		expect(serializeCookie('foo', 'bar', { secure: true })).toBe('foo=bar; Path=/; Secure');
	});

	test('includes HttpOnly when true', () => {
		expect(serializeCookie('foo', 'bar', { httpOnly: true })).toBe('foo=bar; Path=/; HttpOnly');
	});

	test('combines all attributes in the expected order', () => {
		const expires = new Date('2030-01-01T00:00:00.000Z');

		expect(
			serializeCookie('foo', 'bar', { maxAge: 60, expires, path: '/auth', domain: 'brandtegrity.io', sameSite: 'lax', secure: true, httpOnly: true }),
		).toBe(`foo=bar; Max-Age=60; Expires=${expires.toUTCString()}; Path=/auth; Domain=brandtegrity.io; SameSite=Lax; Secure; HttpOnly`);
	});
});

describe('pushSetCookie / flushSetCookies', () => {
	test('pushSetCookie throws an InternalError when the event is null', () => {
		expect(() => pushSetCookie(null, 'foo=bar')).toThrow(new InternalError('Server adapter events must be objects to track outgoing cookies'));
	});

	test('pushSetCookie throws an InternalError when the event is not an object', () => {
		expect(() => pushSetCookie('not-an-object', 'foo=bar')).toThrow(InternalError);
	});

	test('flushSetCookies throws an InternalError when the event is null', () => {
		expect(() => flushSetCookies(null, new Response())).toThrow(new InternalError('Server adapter events must be objects to track outgoing cookies'));
	});

	test('flushSetCookies throws an InternalError when the event is not an object', () => {
		expect(() => flushSetCookies(42, new Response())).toThrow(InternalError);
	});

	test('returns the response unchanged when nothing was pushed', () => {
		const response = flushSetCookies({}, new Response());

		expect(response.headers.getSetCookie()).toEqual([]);
	});

	test('appends all pushed Set-Cookie headers to the response', () => {
		const event = {};
		pushSetCookie(event, 'foo=bar; Path=/');
		pushSetCookie(event, 'baz=qux; Path=/');

		const response = flushSetCookies(event, new Response());

		expect(response.headers.getSetCookie()).toEqual(['foo=bar; Path=/', 'baz=qux; Path=/']);
	});

	test('clears the cookie jar after flushing', () => {
		const event = {};
		pushSetCookie(event, 'foo=bar; Path=/');

		flushSetCookies(event, new Response());
		const response = flushSetCookies(event, new Response());

		expect(response.headers.getSetCookie()).toEqual([]);
	});
});

describe('proxyResponse', () => {
	test('preserves the status and statusText', () => {
		const response = proxyResponse(createHttpResponse({ status: 201, statusText: 'Created' }));

		expect(response.status).toBe(201);
		expect(response.statusText).toBe('Created');
	});

	test('copies allowed headers', () => {
		const response = proxyResponse(createHttpResponse({ headers: new Headers({ 'content-type': 'application/json' }) }));

		expect(response.headers.get('content-type')).toBe('application/json');
	});

	test.each(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'])('excludes the disallowed "%s" header', (header) => {
		const response = proxyResponse(createHttpResponse({ headers: new Headers({ [header]: 'value', 'content-type': 'application/json' }) }));

		expect(response.headers.has(header)).toBe(false);
		expect(response.headers.get('content-type')).toBe('application/json');
	});

	test('omits the set-cookie header when the source response has none', () => {
		const response = proxyResponse(createHttpResponse());

		expect(response.headers.has('set-cookie')).toBe(false);
	});

	test('normalizes a comma-separated set-cookie header without throwing', () => {
		expect(() => proxyResponse(createHttpResponse({ headers: new Headers({ 'set-cookie': 'foo=bar,baz=qux' }) }))).not.toThrow();
	});
});

describe('toSafeRedirect', () => {
	test('returns null when the redirect is missing', () => {
		expect(toSafeRedirect(undefined, 'https://brandtegrity.io')).toBeNull();
		expect(toSafeRedirect(null, 'https://brandtegrity.io')).toBeNull();
		expect(toSafeRedirect('', 'https://brandtegrity.io')).toBeNull();
	});

	test('resolves a relative path against the safe base URL', () => {
		expect(toSafeRedirect('/dashboard', 'https://brandtegrity.io')).toBe('https://brandtegrity.io/dashboard');
	});

	test('resolves correctly when the safe base URL has no trailing slash', () => {
		expect(toSafeRedirect('/dashboard?tab=1', 'https://brandtegrity.io/app')).toBe('https://brandtegrity.io/app/dashboard?tab=1');
	});

	test('returns null when the redirect points to a different origin', () => {
		expect(toSafeRedirect('https://evil.example.com/phish', 'https://brandtegrity.io')).toBeNull();
	});

	test('returns null when the redirect cannot be parsed as a URL', () => {
		expect(toSafeRedirect('http://', 'https://brandtegrity.io')).toBeNull();
	});
});
