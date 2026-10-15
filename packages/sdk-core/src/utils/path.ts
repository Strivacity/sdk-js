import { ProtocolError } from './errors';

/**
 * Adds a `returnTo` query parameter to a URI (for example a login page or the Server SDK refresh route), unless it already has one.
 *
 * @param {string} uri - The URI to extend.
 * @param {string} [returnTo] - Where to return to. Defaults to the current path, query and hash.
 * @returns {string} The URI with `returnTo`.
 */
export function appendReturnTo(uri: string, returnTo?: string): string {
	if (/[?&]returnTo=/.test(uri)) {
		return uri;
	}

	const location = globalThis.location;
	const value = returnTo ?? (location ? `${location.pathname}${location.search}${location.hash}` : '/');

	return `${uri}${uri.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(value)}`;
}

/**
 * Validates a `returnTo` value and turns it into a same-origin path (path, query and hash).
 *
 * @param {string | undefined} returnTo - A path, or an absolute URL on the current origin.
 * @returns {string | undefined} The path, or `undefined` when no value was given.
 * @throws {ProtocolError} If the value points to another origin.
 */
export function toSameOriginPath(returnTo: string | undefined): string | undefined {
	if (!returnTo) {
		return undefined;
	}

	const origin = globalThis.location?.origin ?? 'http://localhost';
	let url: URL;

	try {
		url = new URL(returnTo, origin);
	} catch {
		throw new ProtocolError(`Invalid returnTo: ${returnTo}`);
	}

	if (url.origin !== origin) {
		throw new ProtocolError(`Invalid returnTo: ${returnTo}. Expected a path or a URL on ${origin}`);
	}

	return `${url.pathname}${url.search}${url.hash}`;
}
