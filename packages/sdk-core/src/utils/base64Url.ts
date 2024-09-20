/**
 * Encodes a buffer or string into a Base64 URL-safe string.
 *
 * @param {string | null | BufferSource | ArrayBuffer} buffer The buffer or string to encode.
 * @returns {string} The Base64 URL-encoded string.
 */
function encode(buffer: string | null | BufferSource | ArrayBuffer): string {
	if (typeof buffer === 'string') {
		return buffer;
	}

	const str = String.fromCharCode.apply(null, [...new Uint8Array(buffer as ArrayBuffer)]);

	return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Decodes a Base64 URL-safe string into an ArrayBuffer.
 *
 * @param {string | BufferSource} base64Url The Base64 URL-safe string or BufferSource to decode.
 * @returns {ArrayBuffer} The decoded ArrayBuffer.
 */
function decode(base64Url: string | BufferSource): ArrayBuffer {
	if (typeof base64Url !== 'string') {
		return base64Url as ArrayBuffer;
	}

	const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
	const binStr = atob(base64);
	const binary = new Uint8Array(binStr.length);

	for (let i = 0; i < binStr.length; i++) {
		binary[i] = binStr.charCodeAt(i);
	}

	return binary.buffer;
}

/**
 * Decodes a Base64 URL-safe string into a UTF-8 string.
 *
 * @param {string} base64Url The Base64 URL-safe string to decode.
 * @returns {string} The decoded Unicode string.
 */
function decodeUnicode(base64Url: string): string {
	return decodeURIComponent(
		atob(base64Url).replace(/(.)/g, (m, p) => {
			let code = (p as string).charCodeAt(0).toString(16).toUpperCase();
			if (code.length < 2) {
				code = '0' + code;
			}
			return '%' + code;
		}),
	);
}

export const Base64Url = {
	encode,
	decode,
	decodeUnicode,
};
