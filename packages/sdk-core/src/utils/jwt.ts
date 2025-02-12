import type { JwtClaims } from '../types';
import { Base64Url } from './base64Url';

/**
 * Decodes a JWT token and returns its claims.
 *
 * @template R The expected structure of the JWT claims.
 * @param {string} token The JWT token to decode.
 * @returns {R} The decoded JWT claims.
 * @throws {Error} If the token is invalid or has the wrong format.
 */
function decode<R = JwtClaims>(token: string): R {
	const sections = token.split('.');

	if (sections.length !== 3) {
		throw Error('Invalid JWT');
	}

	return JSON.parse(Base64Url.decodeUnicode(sections[1])) as R;
}

/**
 * Generates a signed JWT token using the provided header, payload, and private key.
 *
 * @param {object} header The JWT header.
 * @param {object} payload The JWT payload.
 * @param {CryptoKey} privateKey The private key to sign the JWT.
 * @returns {Promise<string>} A promise that resolves to the signed JWT token.
 */
async function generate(header: object, payload: object, privateKey: CryptoKey): Promise<string> {
	const encodedHeader = Base64Url.encode(new TextEncoder().encode(JSON.stringify(header)));
	const encodedPayload = Base64Url.encode(new TextEncoder().encode(JSON.stringify(payload)));
	const encodedToken = `${encodedHeader}.${encodedPayload}`;

	const signature = await window.crypto.subtle.sign(
		{
			name: 'ECDSA',
			hash: { name: 'SHA-256' },
		},
		privateKey,
		new TextEncoder().encode(encodedToken),
	);

	const encodedSignature = Base64Url.encode(new Uint8Array(signature));
	return `${encodedToken}.${encodedSignature}`;
}

/**
 * Generates an unsigned JWT token using the provided header and payload.
 * The token will not include a valid signature.
 *
 * @param {object} header The JWT header.
 * @param {object} payload The JWT payload.
 * @returns {string} The unsigned JWT token.
 */
function generateUnsigned(header: object, payload: object): string {
	const encodedHeader = Base64Url.encode(new TextEncoder().encode(JSON.stringify(header)));
	const encodedPayload = Base64Url.encode(new TextEncoder().encode(JSON.stringify(payload)));
	const encodedToken = `${encodedHeader}.${encodedPayload}`;

	return `${encodedToken}.signature`;
}

export const jwt = {
	decode,
	generate,
	generateUnsigned,
};
