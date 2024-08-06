import type { JwtClaims } from '../types';
import { Base64Url } from './base64Url';

function decode<R = JwtClaims>(token: string): R {
	const sections = token.split('.');

	if (sections.length !== 3) {
		throw Error('Invalid JWT');
	}

	return JSON.parse(Base64Url.decodeUnicode(sections[1]));
}

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
