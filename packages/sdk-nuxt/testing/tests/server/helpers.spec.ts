import type { H3Event } from 'h3';
import { describe, test, expect, vi } from 'vitest';
import { proxyResponse, getLocaleFromEvent, toSafeRedirect } from '../../../src/runtime/server/utils/helpers';
import { createHttpResponse } from '@strivacity/testing/mocks/sdk';

function createFakeEvent(headers: Record<string, string> = {}): H3Event {
	return { headers: new Headers(headers) } as unknown as H3Event;
}

describe('proxyResponse', () => {
	test('copies status and headers from the given response onto a new Response', () => {
		const response = createHttpResponse({ status: 201, statusText: 'Created', headers: new Headers({ 'content-type': 'application/json' }) });

		const proxied = proxyResponse(response);

		expect(proxied.status).toBe(201);
		expect(proxied.headers.get('content-type')).toBe('application/json');
	});

	test('strips disallowed proxy headers', () => {
		const response = createHttpResponse({ headers: new Headers({ 'content-encoding': 'gzip', 'content-type': 'application/json' }) });

		const proxied = proxyResponse(response);

		expect(proxied.headers.has('content-encoding')).toBe(false);
		expect(proxied.headers.get('content-type')).toBe('application/json');
	});

	test('preserves a set-cookie header even though it is otherwise skipped by the generic copy loop', () => {
		// happy-dom's Response constructor strips set-cookie from the resulting Headers entirely
		// (a real spec-compliant restriction on response headers), so the outcome can't be observed
		// by reading proxied.headers back out here - spying on the write is the reachable assertion.
		const setSpy = vi.spyOn(Headers.prototype, 'set');
		const response = createHttpResponse({ headers: new Headers({ 'set-cookie': 'sty.session=abc; Path=/' }) });

		proxyResponse(response);

		expect(setSpy).toHaveBeenCalledWith('set-cookie', 'sty.session=abc; Path=/');
	});

	test('carries the response body through unchanged', async () => {
		const response = createHttpResponse({ body: 'raw-body' as unknown as ReadableStream });

		const proxied = proxyResponse(response);

		await expect(proxied.text()).resolves.toBe('raw-body');
	});
});

describe('getLocaleFromEvent', () => {
	test('returns undefined when there is no accept-language header', () => {
		expect(getLocaleFromEvent(createFakeEvent())).toBeUndefined();
	});

	test('extracts the first locale, ignoring quality values', () => {
		expect(getLocaleFromEvent(createFakeEvent({ 'accept-language': 'hu-HU;q=0.9, en-US;q=0.8' }))).toBe('hu-HU');
	});

	test('trims surrounding whitespace from the extracted locale', () => {
		expect(getLocaleFromEvent(createFakeEvent({ 'accept-language': ' hu-HU , en-US' }))).toBe('hu-HU');
	});
});

describe('toSafeRedirect', () => {
	test('returns null when no redirect is given', () => {
		expect(toSafeRedirect(undefined, 'https://brandtegrity.io')).toBeNull();
		expect(toSafeRedirect(null, 'https://brandtegrity.io')).toBeNull();
		expect(toSafeRedirect('', 'https://brandtegrity.io')).toBeNull();
	});

	test('resolves a relative path against the safe base URL', () => {
		expect(toSafeRedirect('/dashboard', 'https://brandtegrity.io')).toBe('https://brandtegrity.io/dashboard');
	});

	test('accepts an absolute URL that shares the same origin', () => {
		expect(toSafeRedirect('https://brandtegrity.io/dashboard?x=1', 'https://brandtegrity.io')).toBe('https://brandtegrity.io/dashboard?x=1');
	});

	test('rejects an absolute URL on a different origin (open redirect protection)', () => {
		expect(toSafeRedirect('https://evil.example.com/phish', 'https://brandtegrity.io')).toBeNull();
	});

	test('returns null when the dangerous redirect cannot be parsed into a URL at all', () => {
		expect(toSafeRedirect('http://[::1', 'https://brandtegrity.io')).toBeNull();
	});
});
