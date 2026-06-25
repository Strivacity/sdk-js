export const Base64URL = {
	/**
	 * Encodes a Uint8Array into a Base64 URL-safe string.
	 *
	 * @param buffer - The ArrayBuffer to encode.
	 * @returns The Base64 URL-safe encoded string.
	 */
	encode(buffer: ArrayBuffer): string {
		return globalThis
			.btoa(String.fromCharCode(...new Uint8Array(buffer)))
			.replace(/=/g, '')
			.replace(/\+/g, '-')
			.replace(/\//g, '_');
	},

	/**
	 * Decodes a Base64 URL-safe string into a Uint8Array.
	 *
	 * @param str - The Base64 URL-safe string to decode.
	 * @returns The decoded ArrayBuffer.
	 */
	decode(str: string): ArrayBuffer {
		const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
		const raw = globalThis.atob(base64);
		const bin = new Uint8Array(raw.length);

		for (let i = 0; i < raw.length; i++) {
			bin[i] = raw.charCodeAt(i);
		}

		return bin.buffer;
	},
};
