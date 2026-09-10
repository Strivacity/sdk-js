import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Readable } from 'node:stream';

/**
 * Converts an incoming Express request into a standard Web `Request`.
 *
 * @param {ExpressRequest} req - The incoming Express request.
 * @returns {Request} The equivalent Web `Request` object.
 */
export function toWebRequest(req: ExpressRequest): Request {
	const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
	const headers = new Headers();

	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined) {
			continue;
		}

		for (const v of Array.isArray(value) ? value : [value]) {
			headers.append(key, v);
		}
	}

	const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

	return new Request(url, {
		method: req.method,
		headers,
		...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
	} as RequestInit);
}

/**
 * Writes a standard Web `Response` (built by the shared server SDK core) onto the Express response.
 *
 * @param {Response} response - The `Response` to write.
 * @param {ExpressResponse} res - The Express response to write to.
 */
export async function applyResponse(response: Response, res: ExpressResponse): Promise<void> {
	res.status(response.status);

	for (const [key, value] of response.headers.entries()) {
		if (key.toLowerCase() === 'set-cookie') {
			continue;
		}

		res.setHeader(key, value);
	}

	const setCookies = response.headers.getSetCookie();

	if (setCookies.length) {
		res.setHeader('set-cookie', setCookies);
	}

	if (!response.body) {
		res.end();
		return;
	}

	await new Promise<void>((resolve, reject) => {
		Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
			.pipe(res)
			.on('finish', resolve)
			.on('error', reject);
	});
}
