import { decodeBase64URL, encodeBase64URL } from './base64url';

/**
 * Derives a cryptographic key from the provided secret, salt, and context using the HKDF (HMAC-based Extract-and-Expand Key Derivation Function) algorithm.
 *
 * @param {string} secret - The input key material (IKM).
 * @param {Uint8Array} salt - A random salt (should be stored alongside the ciphertext).
 * @param {string} context - A context string that binds the key to its intended purpose (e.g. 'session', 'transaction').
 * @returns {Promise<CryptoKey>} A promise that resolves to the derived AES-GCM CryptoKey.
 */
async function deriveKey(secret: string, salt: Uint8Array, context: string): Promise<CryptoKey> {
	const ikm = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveBits']);

	const keyBits = await globalThis.crypto.subtle.deriveBits(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: salt.buffer as ArrayBuffer,
			info: new TextEncoder().encode(context),
		},
		ikm,
		32 << 3, // 256 bits
	);

	return globalThis.crypto.subtle.importKey('raw', keyBits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypts a plaintext string using AES-GCM with a per-operation salt and IV.
 * The output format is Base64URL( salt(16) + iv(12) + ciphertext ).
 * A fresh HKDF key is derived for each encryption using the provided secret and context.
 *
 * @param {string} plaintext - The plaintext string to be encrypted.
 * @param {string} secret - The input key material.
 * @param {string} context - A context string that binds the key to its intended purpose.
 * @returns {Promise<string>} A promise that resolves to the Base64URL-encoded payload.
 */
export async function encryptString(plaintext: string, secret: string, context: string): Promise<string> {
	const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
	const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
	const cryptoKey = await deriveKey(secret, salt, context);
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
	const combined = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);

	combined.set(salt, 0);
	combined.set(iv, salt.byteLength);
	combined.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);

	return encodeBase64URL(combined.buffer);
}

/**
 * Decrypts a Base64URL-encoded payload produced by {@link encryptString}.
 * Expects the format: salt(16) + iv(12) + ciphertext.
 * If decryption fails (e.g., due to tampering or incorrect key), the function returns null.
 *
 * @param {string} encoded - The Base64URL-encoded payload to be decrypted.
 * @param {string} secret - The input key material.
 * @param {string} context - The context string used during encryption.
 * @returns {Promise<string | null>} A promise that resolves to the decrypted plaintext string, or null if decryption fails.
 */
export async function decryptString(encoded: string, secret: string, context: string): Promise<string | null> {
	try {
		const combined = new Uint8Array(decodeBase64URL(encoded));
		const salt = combined.slice(0, 16);
		const iv = combined.slice(16, 28);
		const ciphertext = combined.slice(28);
		const cryptoKey = await deriveKey(secret, salt, context);
		const plaintext = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);

		return new TextDecoder().decode(plaintext);
	} catch {
		return null;
	}
}
