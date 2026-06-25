/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, test, expect, afterEach } from 'vitest';
import { createWebAuthnCredential, assertWebAuthnCredential } from '../../../src/utils/credentials';
import { ProtocolError } from '../../../src/utils/errors';
import { encodeBase64URL } from '../../../src/utils/base64url';
import { creationOptions, fromBuffer, mockCredentials, requestOptions, toBuffer } from '@strivacity/testing/mocks/credentials';

describe('createWebAuthnCredential', () => {
	afterEach(() => {
		delete (navigator as any).credentials;
	});

	test('decodes the challenge, user id and excludeCredentials ids, and returns the formatted registration response', async () => {
		let capturedPublicKey: any;

		mockCredentials({
			create: (options) => {
				capturedPublicKey = options.publicKey;
				return Promise.resolve({
					id: 'credential-id',
					rawId: toBuffer('raw-id'),
					type: 'public-key',
					authenticatorAttachment: 'platform',
					response: {
						clientDataJSON: toBuffer('client-data'),
						attestationObject: toBuffer('attestation'),
						getTransports: () => ['internal'],
					},
					getClientExtensionResults: () => ({ foo: 'bar' }),
				});
			},
		});

		const result = await createWebAuthnCredential(
			creationOptions({ excludeCredentials: [{ id: encodeBase64URL(toBuffer('exclude-1')), type: 'public-key' }] }),
		);

		expect(fromBuffer(capturedPublicKey.challenge)).toBe('challenge');
		expect(fromBuffer(capturedPublicKey.user.id)).toBe('user-1');
		expect(fromBuffer(capturedPublicKey.excludeCredentials[0].id)).toBe('exclude-1');

		expect(result).toEqual({
			id: 'credential-id',
			rawId: encodeBase64URL(toBuffer('raw-id')),
			response: {
				clientDataJSON: encodeBase64URL(toBuffer('client-data')),
				attestationObject: encodeBase64URL(toBuffer('attestation')),
				transports: ['internal'],
			},
			authenticatorAttachment: 'platform',
			clientExtensionResults: { foo: 'bar' },
			type: 'public-key',
		});
	});

	test('defaults excludeCredentials to an empty array when not provided', async () => {
		let capturedPublicKey: any;

		mockCredentials({
			create: (options) => {
				capturedPublicKey = options.publicKey;
				return Promise.resolve({
					type: 'public-key',
					rawId: toBuffer('raw-id'),
					response: { clientDataJSON: toBuffer(''), attestationObject: toBuffer('') },
					getClientExtensionResults: () => ({}),
				});
			},
		});

		await createWebAuthnCredential(creationOptions());

		expect(capturedPublicKey.excludeCredentials).toEqual([]);
	});

	test('defaults transports to an empty array when the response has no getTransports', async () => {
		mockCredentials({
			create: () =>
				Promise.resolve({
					type: 'public-key',
					rawId: toBuffer('raw-id'),
					response: { clientDataJSON: toBuffer(''), attestationObject: toBuffer('') },
					getClientExtensionResults: () => ({}),
				}),
		});

		const result = await createWebAuthnCredential(creationOptions());

		expect(result.response.transports).toEqual([]);
	});

	test('forwards the provided AbortController signal to navigator.credentials.create', async () => {
		let capturedSignal: AbortSignal | undefined;
		const abortController = new AbortController();

		mockCredentials({
			create: (options) => {
				capturedSignal = options.signal;
				return Promise.resolve({
					type: 'public-key',
					rawId: toBuffer('raw-id'),
					response: { clientDataJSON: toBuffer(''), attestationObject: toBuffer('') },
					getClientExtensionResults: () => ({}),
				});
			},
		});

		await createWebAuthnCredential(creationOptions(), abortController);

		expect(capturedSignal).toBe(abortController.signal);
	});

	test('throws a ProtocolError when the created credential is not a public-key credential', async () => {
		mockCredentials({ create: () => Promise.resolve({ type: 'other', response: {} }) });

		await expect(createWebAuthnCredential(creationOptions())).rejects.toThrow(new ProtocolError('Not a public key'));
	});
});

describe('assertWebAuthnCredential', () => {
	afterEach(() => {
		delete (navigator as any).credentials;
	});

	test('decodes the challenge and allowCredentials ids, and returns credential.toJSON()', async () => {
		let capturedPublicKey: any;
		const toJSONResult = { id: 'credential-id' };

		mockCredentials({
			get: (options) => {
				capturedPublicKey = options.publicKey;
				return Promise.resolve({ type: 'public-key', toJSON: () => toJSONResult });
			},
		});

		const result = await assertWebAuthnCredential(requestOptions({ allowCredentials: [{ id: encodeBase64URL(toBuffer('allow-1')), type: 'public-key' }] }));

		expect(fromBuffer(capturedPublicKey.challenge)).toBe('challenge');
		expect(fromBuffer(capturedPublicKey.allowCredentials[0].id)).toBe('allow-1');
		expect(result).toBe(toJSONResult);
	});

	test('defaults allowCredentials to an empty array when not provided', async () => {
		let capturedPublicKey: any;

		mockCredentials({
			get: (options) => {
				capturedPublicKey = options.publicKey;
				return Promise.resolve({ type: 'public-key', toJSON: () => ({}) });
			},
		});

		await assertWebAuthnCredential(requestOptions());

		expect(capturedPublicKey.allowCredentials).toEqual([]);
	});

	test('defaults the mediation requirement to "optional"', async () => {
		let capturedMediation;

		mockCredentials({
			get: (options) => {
				capturedMediation = options.mediation;
				return Promise.resolve({ type: 'public-key', toJSON: () => ({}) });
			},
		});

		await assertWebAuthnCredential(requestOptions());

		expect(capturedMediation).toBe('optional');
	});

	test('uses the provided mediation requirement', async () => {
		let capturedMediation;

		mockCredentials({
			get: (options) => {
				capturedMediation = options.mediation;

				return Promise.resolve({ type: 'public-key', toJSON: () => ({}) });
			},
		});

		await assertWebAuthnCredential(requestOptions(), 'conditional');

		expect(capturedMediation).toBe('conditional');
	});

	test('throws a ProtocolError when the retrieved credential is not a public-key credential', async () => {
		mockCredentials({ get: () => Promise.resolve({ type: 'other', toJSON: () => ({}) }) });

		await expect(assertWebAuthnCredential(requestOptions())).rejects.toThrow(new ProtocolError('Not a public key'));
	});
});
