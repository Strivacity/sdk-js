/**
 * Encodes an ArrayBuffer into a Base64 URL-safe string.
 *
 * @param buffer - The ArrayBuffer to encode.
 * @returns The Base64 URL-safe encoded string.
 */
export function encodeBase64URL(buffer: ArrayBuffer): string {
	return globalThis
		.btoa(String.fromCharCode(...new Uint8Array(buffer)))
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

/**
 * Decodes a Base64 URL-safe string into an ArrayBuffer.
 *
 * @param str - The Base64 URL-safe string to decode.
 * @returns The decoded ArrayBuffer.
 */
export function decodeBase64URL(str: string): ArrayBuffer {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const raw = globalThis.atob(base64);
	const bin = new Uint8Array(raw.length);

	for (let i = 0; i < raw.length; i++) {
		bin[i] = raw.charCodeAt(i);
	}

	return bin.buffer;
}
