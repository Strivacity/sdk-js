import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Readable, Writable } from 'node:stream';
import { describe, test, expect, vi } from 'vitest';
import { applyResponse, toWebRequest } from '../../../src/server/utils';

function fakeExpressRequest(overrides: Partial<ExpressRequest> = {}): ExpressRequest {
	return {
		originalUrl: '/callback?code=abc',
		protocol: 'https',
		method: 'GET',
		headers: {},
		get: (name: string) => (name.toLowerCase() === 'host' ? 'brandtegrity.io' : undefined),
		...overrides,
	} as ExpressRequest;
}

describe('toWebRequest', () => {
	test('returns a standard Request unchanged', () => {
		const request = new Request('https://brandtegrity.io');

		expect(toWebRequest(request)).toBe(request);
	});

	test('converts an Express request into an equivalent standard Request', () => {
		const req = fakeExpressRequest({ headers: { 'x-foo': 'bar', 'x-multi': ['a', 'b'], 'x-missing': undefined } });

		const request = toWebRequest(req);

		expect(request.url).toBe('https://brandtegrity.io/callback?code=abc');
		expect(request.method).toBe('GET');
		expect(request.headers.get('x-foo')).toBe('bar');
		expect(request.headers.get('x-multi')).toBe('a, b');
		expect(request.headers.has('x-missing')).toBe(false);
		expect(request.body).toBeNull();
	});

	test('does not attach a body for a HEAD request', () => {
		const request = toWebRequest(fakeExpressRequest({ method: 'HEAD' }));

		expect(request.body).toBeNull();
	});

	test('streams the request body for non-GET/HEAD requests', async () => {
		const req = Object.assign(Readable.from(['{"a":1}']), fakeExpressRequest({ method: 'POST' })) as unknown as ExpressRequest;

		const request = toWebRequest(req);

		expect(request.method).toBe('POST');
		expect(request.body).not.toBeNull();
		await expect(request.text()).resolves.toBe('{"a":1}');
	});
});

describe('applyResponse', () => {
	function fakeExpressResponse() {
		const chunks: Array<Buffer> = [];
		const stream = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(chunk as Buffer);
				callback();
			},
		}) as Writable & ExpressResponse;

		stream.status = vi.fn().mockReturnValue(stream) as never;
		stream.setHeader = vi.fn().mockReturnValue(stream) as never;
		stream.end = vi.fn(Writable.prototype.end.bind(stream)) as never;

		return { res: stream, chunks };
	}

	test('sets the status and copies headers other than set-cookie', async () => {
		const response = new Response(null, { status: 204, headers: { 'x-foo': 'bar' } });
		const { res } = fakeExpressResponse();

		await applyResponse(response, res);

		expect(res.status).toHaveBeenCalledWith(204);
		expect(res.setHeader).toHaveBeenCalledWith('x-foo', 'bar');
		expect(res.setHeader).not.toHaveBeenCalledWith('set-cookie', expect.anything());
	});

	test('collects multiple set-cookie headers onto a single set-cookie header', async () => {
		// appended after construction rather than passed via the Response init - this test environment's fetch
		// polyfill silently drops every header when a set-cookie entry is present in the constructor's `headers` init
		const response = new Response(null, { status: 200 });
		response.headers.append('set-cookie', 'a=1');
		response.headers.append('set-cookie', 'b=2');
		const { res } = fakeExpressResponse();

		await applyResponse(response, res);

		expect(res.setHeader).toHaveBeenCalledWith('set-cookie', ['a=1', 'b=2']);
	});

	test('ends the response immediately when there is no body', async () => {
		const response = new Response(null, { status: 204 });
		const { res } = fakeExpressResponse();

		await applyResponse(response, res);

		expect(res.end).toHaveBeenCalledTimes(1);
	});

	test('streams a present body onto the express response', async () => {
		const response = new Response('hello world', { status: 200 });
		const { res, chunks } = fakeExpressResponse();

		await applyResponse(response, res);

		expect(Buffer.concat(chunks).toString()).toBe('hello world');
	});
});
