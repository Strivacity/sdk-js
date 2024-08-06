import { Base64Url } from './base64Url';

function generateState(): string {
	return crypto.randomUUID().replace(/-/g, '');
}

function generateNonce(): string {
	return crypto.randomUUID().replace(/-/g, '');
}

function generateCodeVerifier(): string {
	return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
	return Base64Url.encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)));
}

export const Crypto = {
	generateState,
	generateNonce,
	generateCodeVerifier,
	generateCodeChallenge,
};
