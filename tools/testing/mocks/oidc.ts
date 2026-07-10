import { encodeBase64URL } from '../../../packages/sdk-core/src/utils/base64url';
import { timestamp } from '../../../packages/sdk-core/src/utils/common';
import type { IdTokenClaims, SigningKey } from '../../../packages/sdk-core/src/types/oidc';
import { BACKCHANNEL_LOGOUT_EVENT } from '../../../packages/sdk-core/src/utils/server';

function encodeSegment(value: unknown): string {
	return encodeBase64URL(new TextEncoder().encode(JSON.stringify(value)).buffer);
}

export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, [
		'sign',
		'verify',
	]);
}

export async function exportSigningKey(publicKey: CryptoKey, kid: string): Promise<SigningKey> {
	const jwk = await crypto.subtle.exportKey('jwk', publicKey);

	return { kty: jwk.kty!, n: jwk.n!, e: jwk.e!, use: 'sig', alg: 'RS256', kid };
}

export async function signRS256(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: CryptoKey): Promise<string> {
	const encodedHeader = encodeBase64URL(new TextEncoder().encode(JSON.stringify(header)).buffer);
	const encodedPayload = encodeBase64URL(new TextEncoder().encode(JSON.stringify(payload)).buffer);
	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));

	return `${encodedHeader}.${encodedPayload}.${encodeBase64URL(signature)}`;
}

export function buildIdTokenClaims(overrides: Partial<IdTokenClaims> = {}): IdTokenClaims {
	const now = timestamp();

	return {
		iss: 'https://brandtegrity.io/',
		sub: 'user-1',
		aud: 'client-id',
		exp: now + 3600,
		iat: now,
		jti: crypto.randomUUID(),
		...overrides,
	};
}

export function buildIdToken(claims: Record<string, unknown>): string {
	const header = encodeBase64URL(new TextEncoder().encode(JSON.stringify({ alg: 'none' })).buffer);
	const payload = encodeBase64URL(new TextEncoder().encode(JSON.stringify(claims)).buffer);

	return `${header}.${payload}.signature`;
}

export async function signLogoutToken(claims: Record<string, unknown>, privateKey: CryptoKey, kid: string): Promise<string> {
	const header = encodeSegment({ alg: 'RS256', kid });
	const payload = encodeSegment(claims);
	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${header}.${payload}`));

	return `${header}.${payload}.${encodeBase64URL(signature)}`;
}

export function buildLogoutTokenClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		iss: 'https://brandtegrity.io/',
		aud: 'client-id',
		iat: timestamp(),
		jti: crypto.randomUUID(),
		events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
		sid: 'session-id',
		...overrides,
	};
}
