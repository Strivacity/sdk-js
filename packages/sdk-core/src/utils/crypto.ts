import { Base64Url } from './base64Url';

/**
 * Generates a unique state string using UUID, suitable for OAuth flows.
 *
 * @returns {string} A randomly generated state string.
 */
function generateState(): string {
	return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Generates a unique nonce using UUID, suitable for security in OAuth flows.
 *
 * @returns {string} A randomly generated nonce string.
 */
function generateNonce(): string {
	return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Generates a code verifier for PKCE (Proof Key for Code Exchange).
 *
 * @returns {string} A randomly generated code verifier string.
 */
function generateCodeVerifier(): string {
	return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
}

/**
 * Generates a code challenge from a code verifier using SHA-256 hashing.
 *
 * @param {string} codeVerifier The code verifier string.
 * @returns {Promise<string>} A promise that resolves to the generated code challenge.
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
	return Base64Url.encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)));
}

export const Crypto = {
	generateState,
	generateNonce,
	generateCodeVerifier,
	generateCodeChallenge,
};
