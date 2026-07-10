import { vi } from 'vitest';
import { encodeBase64URL } from '../../../packages/sdk-core/src/utils/base64url';

export function toBuffer(text: string): ArrayBuffer {
	return new TextEncoder().encode(text).buffer;
}

export function fromBuffer(buffer: ArrayBuffer): string {
	return new TextDecoder().decode(buffer);
}

export function mockCredentials(methods: { create?: (options: any) => Promise<unknown>; get?: (options: any) => Promise<unknown> }): void {
	Object.defineProperty(navigator, 'credentials', {
		value: { create: vi.fn(), get: vi.fn(), ...methods },
		configurable: true,
	});
}

export function creationOptions(overrides: Record<string, unknown> = {}) {
	return {
		challenge: encodeBase64URL(toBuffer('challenge')),
		rp: { name: 'Strivacity', id: 'brandtegrity.io' },
		user: { id: encodeBase64URL(toBuffer('user-1')), name: 'user', displayName: 'User' },
		pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
		...overrides,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

export function requestOptions(overrides: Record<string, unknown> = {}) {
	return {
		challenge: encodeBase64URL(toBuffer('challenge')),
		...overrides,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}
