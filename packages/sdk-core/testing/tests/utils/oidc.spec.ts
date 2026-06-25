import { beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createOptions, getMockStorage } from '@strivacity/testing/mocks/sdk';
import { worker } from '@strivacity/testing/mocks/msw';
import openidConfiguration from '@strivacity/testing/fixtures/openid-configuration.json';
import {
	decodeJwt,
	verifyJwt,
	generateJwt,
	verifyIdToken,
	refreshToken,
	generateCodeVerifier,
	generateCodeChallenge,
	generateRandomHex,
	buildAuthorizationUrl,
	exchangeCode,
	getDefaultFlowState,
	defaultOptions,
} from '../../../src/utils/oidc';
import { NetworkError, ServerError, ProtocolError } from '../../../src/utils/errors';
import { encodeBase64URL, decodeBase64URL } from '../../../src/utils/base64url';
import { buildIdToken, buildIdTokenClaims, exportSigningKey, generateRSAKeyPair, signRS256 } from '@strivacity/testing/mocks/oidc';
import type { IdTokenClaims } from '../../../src/types/oidc';

describe('getDefaultFlowState', () => {
	test('should return the default flow state', () => {
		expect(getDefaultFlowState()).toEqual({
			initialized: false,
			session: null,
			sessionId: null,
			shortAppId: null,
			language: globalThis.navigator.language,
		});
	});

	test('should fall back to "en-US" when navigator.language is unavailable', () => {
		vi.stubGlobal('navigator', {});

		expect(getDefaultFlowState().language).toBe('en-US');

		vi.unstubAllGlobals();
	});
});

describe('defaultOptions', () => {
	test('should provide the default SDK options', () => {
		expect(defaultOptions).toEqual({
			lazyLoad: false,
			autoRefresh: true,
			serverSessionUri: null,
			scopes: ['openid'],
			responseType: 'code',
			responseMode: 'query',
			storageTokenName: 'sty.session',
			discoveryDocumentCacheTTL: 3600,
			jwksCacheTTL: 600,
		});
	});
});

describe('generateCodeVerifier', () => {
	test('generates a verifier between 43 and 128 characters, using only the unreserved charset', () => {
		for (let i = 0; i < 50; i++) {
			const verifier = generateCodeVerifier();

			expect(verifier.length).toBeGreaterThanOrEqual(43);
			expect(verifier.length).toBeLessThanOrEqual(128);
			expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
		}
	});

	test('generates cryptographically random, non-colliding verifiers', () => {
		const verifiers = new Set(Array.from({ length: 2000 }, () => generateCodeVerifier()));

		expect(verifiers.size).toBe(2000);
	});
});

describe('generateCodeChallenge', () => {
	test('derives base64url(SHA-256(verifier)) using the RFC 7636 Appendix B fixed vector', async () => {
		await expect(generateCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
	});

	test('produces an unpadded base64url string (no "=", "+", or "/")', async () => {
		const challenge = await generateCodeChallenge(generateCodeVerifier());

		expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
	});
});

describe('generateRandomHex', () => {
	test('generates non-colliding random hex strings', () => {
		const values = new Set(Array.from({ length: 2000 }, () => generateRandomHex(16)));

		expect(values.size).toBe(2000);
	});
});

describe('buildAuthorizationUrl', () => {
	test('sets response_type=code exactly once', async () => {
		const url = await buildAuthorizationUrl({ params: {}, options: createOptions() });

		expect(url.searchParams.getAll('response_type')).toEqual(['code']);
	});

	test('sets client_id verbatim, including hostile/reserved characters', async () => {
		const options = createOptions({ clientId: 'client+id with space&reserved=chars 例え' });
		const url = await buildAuthorizationUrl({ params: {}, options });

		expect(url.searchParams.get('client_id')).toBe('client+id with space&reserved=chars 例え');
	});

	test('sets redirect_uri byte-identical to the configured value, without normalization', async () => {
		const options = createOptions({ redirectUri: 'https://Brandtegrity.io:443/Callback' });
		const url = await buildAuthorizationUrl({ params: {}, options });

		expect(url.searchParams.get('redirect_uri')).toBe('https://Brandtegrity.io:443/Callback');
	});

	test('never emits any parameter more than once', async () => {
		const url = await buildAuthorizationUrl({
			params: { prompt: 'login', display: 'page', loginHint: 'user@example.com', acrValues: ['urn:a'], uiLocales: ['en-US'], audiences: ['aud-1'] },
			options: createOptions(),
		});

		for (const key of url.searchParams.keys()) {
			expect(url.searchParams.getAll(key)).toHaveLength(1);
		}
	});

	test('preserves an existing query string on a custom authorization endpoint', async () => {
		const url = await buildAuthorizationUrl({ url: 'https://brandtegrity.io/authorize?tenant=acme', params: {}, options: createOptions() });

		expect(url.searchParams.get('tenant')).toBe('acme');
		expect(url.searchParams.get('response_type')).toBe('code');
	});

	test('rejects an authorization endpoint scheme other than https', async () => {
		vi.resetModules();

		const { getDiscoveryDocument } = await import('../../../src/utils/oidc');

		worker.use(
			http.get('https://brandtegrity.io/.well-known/openid-configuration', () =>
				HttpResponse.json({ ...openidConfiguration, authorization_endpoint: 'http://brandtegrity.io/oauth2/authorize' }),
			),
		);

		await expect(getDiscoveryDocument(createOptions())).rejects.toThrow('must be an https:// URL');
	});

	test('space-delimits and deduplicates scope entries', async () => {
		const options = createOptions({ scopes: ['openid', 'profile', 'openid', 'email'] });
		const url = await buildAuthorizationUrl({ params: {}, options });

		expect(url.searchParams.get('scope')).toBe('openid profile email');
	});

	test('sets state unconditionally', async () => {
		const url = await buildAuthorizationUrl({ params: {}, options: createOptions() });

		expect(url.searchParams.get('state')).toBeTruthy();
	});

	test('omits optional parameters entirely when unset, rather than emitting them empty', async () => {
		const url = await buildAuthorizationUrl({ params: {}, options: createOptions() });

		for (const key of ['prompt', 'display', 'login_hint', 'acr_values', 'ui_locales', 'audience', 'max_age']) {
			expect(url.searchParams.has(key)).toBe(false);
		}
	});

	test('percent-encodes pass-through parameters exactly once', async () => {
		const url = await buildAuthorizationUrl({ params: { loginHint: 'a b+c%20d@例え.jp' }, options: createOptions() });

		expect(url.searchParams.get('login_hint')).toBe('a b+c%20d@例え.jp');
		expect(url.toString()).toContain('login_hint=a+b%2Bc%2520d%40%E4%BE%8B%E3%81%88.jp');
	});

	test('always uses S256 for code_challenge_method, never "plain"', async () => {
		const url = await buildAuthorizationUrl({ params: {}, options: createOptions() });

		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
	});

	test('never places the code_verifier in the authorization URL', async () => {
		const options = createOptions();
		const url = await buildAuthorizationUrl({ params: {}, options });
		const codeVerifier = getMockStorage(options.stateStorage).getLastState()?.codeVerifier;

		expect(codeVerifier).toBeTruthy();
		expect(url.searchParams.has('code_verifier')).toBe(false);
		expect(url.toString()).not.toContain(codeVerifier);
	});

	test('never emits a client secret', () => {
		expect(JSON.stringify(createOptions())).not.toMatch(/client_secret|clientSecret/i);
	});

	test('persists a unique PKCE verifier per call, even for concurrent journeys', async () => {
		const options = createOptions();

		await Promise.all(Array.from({ length: 20 }, () => buildAuthorizationUrl({ params: {}, options })));

		const verifiers = new Set(
			getMockStorage(options.stateStorage)
				.values()
				.map((value) => (JSON.parse(value) as { codeVerifier: string }).codeVerifier),
		);

		expect(verifiers.size).toBe(20);
	});

	test('accepts a valid prompt value and stores it on the state', async () => {
		const url = await buildAuthorizationUrl({ params: { prompt: 'login' }, options: createOptions() });

		expect(url.searchParams.get('prompt')).toBe('login');
	});
});

describe('getDiscoveryDocument', () => {
	let getDiscoveryDocument: (typeof import('../../../src/utils/oidc'))['getDiscoveryDocument'];

	beforeEach(async () => {
		vi.resetModules();

		// NOTE: Disable caching by resetting the module before each test
		({ getDiscoveryDocument } = await import('../../../src/utils/oidc'));
	});

	test('fetches and returns the discovery document from the issuer', async () => {
		await expect(getDiscoveryDocument(createOptions())).resolves.toMatchObject({
			issuer: 'https://brandtegrity.io/',
			token_endpoint: 'https://brandtegrity.io/oauth2/token',
		});
	});

	test('caches the document and does not refetch while the TTL is valid', async () => {
		const options = createOptions();
		const requestSpy = vi.spyOn(options.httpClient, 'request');

		await getDiscoveryDocument(options);
		await getDiscoveryDocument(options);

		expect(requestSpy).toHaveBeenCalledTimes(1);
	});

	test('dedupes concurrent fetches into a single request', async () => {
		const options = createOptions();
		const requestSpy = vi.spyOn(options.httpClient, 'request');

		await Promise.all([getDiscoveryDocument(options), getDiscoveryDocument(options)]);

		expect(requestSpy).toHaveBeenCalledTimes(1);
	});

	describe('error handling', () => {
		test('throws a ServerError when the request fails', async () => {
			worker.use(http.get('https://brandtegrity.io/.well-known/openid-configuration', () => new HttpResponse(null, { status: 500 })));

			await expect(getDiscoveryDocument(createOptions())).rejects.toThrow('Failed to fetch OIDC metadata');
		});

		test('throws a ProtocolError when the issuer does not match', async () => {
			worker.use(
				http.get('https://brandtegrity.io/.well-known/openid-configuration', () =>
					HttpResponse.json({ ...openidConfiguration, issuer: 'https://other.example.com' }),
				),
			);

			await expect(getDiscoveryDocument(createOptions())).rejects.toThrow('Discovery document issuer mismatch');
		});

		test.each(['authorization_endpoint', 'token_endpoint', 'jwks_uri'])('throws a ProtocolError when %s is missing', async (field) => {
			worker.use(http.get('https://brandtegrity.io/.well-known/openid-configuration', () => HttpResponse.json({ ...openidConfiguration, [field]: undefined })));

			await expect(getDiscoveryDocument(createOptions())).rejects.toThrow(`Discovery document is missing required field: ${field}`);
		});

		test('throws a ProtocolError when issuer is missing entirely', async () => {
			worker.use(http.get('https://brandtegrity.io/.well-known/openid-configuration', () => HttpResponse.json({ ...openidConfiguration, issuer: undefined })));

			await expect(getDiscoveryDocument(createOptions())).rejects.toThrow('Discovery document issuer mismatch');
		});

		test('does not cache a failed fetch, and a subsequent call can still succeed', async () => {
			vi.resetModules();

			const { getDiscoveryDocument: freshGetDiscoveryDocument } = await import('../../../src/utils/oidc');

			worker.use(http.get('https://brandtegrity.io/.well-known/openid-configuration', () => new HttpResponse(null, { status: 500 }), { once: true }));

			await expect(freshGetDiscoveryDocument(createOptions())).rejects.toThrow('Failed to fetch OIDC metadata');
			await expect(freshGetDiscoveryDocument(createOptions())).resolves.toMatchObject({ issuer: 'https://brandtegrity.io/' });
		});

		test('throws a ProtocolError when a required endpoint is not an https:// URL on the issuer host', async () => {
			worker.use(
				http.get('https://brandtegrity.io/.well-known/openid-configuration', () =>
					HttpResponse.json({ ...openidConfiguration, token_endpoint: 'https://evil.example.com/oauth2/token' }),
				),
			);

			await expect(getDiscoveryDocument(createOptions())).rejects.toThrow(
				'Discovery document field "token_endpoint" must be an https:// URL on brandtegrity.io',
			);
		});

		test('throws a ProtocolError when an optional endpoint is invalid', async () => {
			worker.use(
				http.get('https://brandtegrity.io/.well-known/openid-configuration', () =>
					HttpResponse.json({ ...openidConfiguration, revocation_endpoint: 'http://brandtegrity.io/oauth2/revoke' }),
				),
			);

			await expect(getDiscoveryDocument(createOptions())).rejects.toThrow('Discovery document field "revocation_endpoint" must be an https:// URL');
		});

		test('throws a ProtocolError when S256 PKCE is not advertised', async () => {
			worker.use(
				http.get('https://brandtegrity.io/.well-known/openid-configuration', () =>
					HttpResponse.json({ ...openidConfiguration, code_challenge_methods_supported: ['plain'] }),
				),
			);

			await expect(getDiscoveryDocument(createOptions())).rejects.toThrow('Discovery document does not advertise S256 PKCE support');
		});

		test('throws a ProtocolError when response body is not valid JSON', async () => {
			worker.use(http.get('https://brandtegrity.io/.well-known/openid-configuration', () => HttpResponse.text('<html>not json</html>')));

			await expect(getDiscoveryDocument(createOptions())).rejects.toThrow('Non-JSON response from discovery document endpoint');
		});
	});
});

describe('getJwks', () => {
	let keyPair: CryptoKeyPair;

	beforeAll(async () => {
		keyPair = await generateRSAKeyPair();
	});

	test('fetches and caches the key set, avoiding a refetch on the next call', async () => {
		const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;
		const signingKey = await exportSigningKey(keyPair.publicKey, 'kid-cache');
		let requestCount = 0;

		worker.use(
			http.get(jwksUri, () => {
				requestCount++;

				return HttpResponse.json({ keys: [signingKey] });
			}),
		);

		const token = await signRS256({ alg: 'RS256', kid: 'kid-cache' }, { sub: 'user-1' }, keyPair.privateKey);
		const options = createOptions();

		await verifyJwt({ token, jwksUri, options });
		await verifyJwt({ token, jwksUri, options });

		expect(requestCount).toBe(1);
	});

	test('force-refreshes the key set when the requested kid is missing from the cache', async () => {
		const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;
		const otherKeyPair = await generateRSAKeyPair();
		const firstKey = await exportSigningKey(otherKeyPair.publicKey, 'kid-old');
		const secondKey = await exportSigningKey(keyPair.publicKey, 'kid-new');
		let requestCount = 0;

		worker.use(
			http.get(jwksUri, () => {
				requestCount++;

				return HttpResponse.json({ keys: requestCount === 1 ? [firstKey] : [firstKey, secondKey] });
			}),
		);

		const options = createOptions();
		const firstToken = await signRS256({ alg: 'RS256', kid: 'kid-old' }, { sub: 'a' }, otherKeyPair.privateKey);

		await verifyJwt({ token: firstToken, jwksUri, options });

		const secondToken = await signRS256({ alg: 'RS256', kid: 'kid-new' }, { sub: 'b' }, keyPair.privateKey);

		await expect(verifyJwt({ token: secondToken, jwksUri, options })).resolves.toEqual({ sub: 'b' });
		expect(requestCount).toBe(2);
	});

	test('force-refreshes exactly once per unknown kid, never looping', async () => {
		const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;
		const signingKey = await exportSigningKey(keyPair.publicKey, 'the-real-kid');
		let requestCount = 0;

		worker.use(
			http.get(jwksUri, () => {
				requestCount++;

				return HttpResponse.json({ keys: [signingKey] });
			}),
		);

		const options = createOptions();
		const hostileToken = await signRS256({ alg: 'RS256', kid: 'unknown-kid' }, {}, keyPair.privateKey);

		await expect(verifyJwt({ token: hostileToken, jwksUri, options })).rejects.toThrow('No matching key found in JWKS');
		expect(requestCount).toBe(2);
	});

	describe('error handling', () => {
		test('throws a NetworkError when the JWKS request fails due to a network issue', async () => {
			const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;

			worker.use(http.get(jwksUri, () => HttpResponse.error()));

			const token = await signRS256({ alg: 'RS256', kid: 'kid-network-error' }, { sub: 'user-1' }, keyPair.privateKey);

			await expect(verifyJwt({ token, jwksUri, options: createOptions() })).rejects.toThrow(new NetworkError(`Failed to fetch JWKS: ${jwksUri}`));
		});

		test('throws a ServerError when the JWKS request fails with a server error', async () => {
			const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;

			worker.use(http.get(jwksUri, () => new HttpResponse(null, { status: 500 })));

			const token = await signRS256({ alg: 'RS256', kid: 'kid-server-error' }, { sub: 'user-1' }, keyPair.privateKey);

			await expect(verifyJwt({ token, jwksUri, options: createOptions() })).rejects.toThrow(new ServerError('Failed to fetch JWKS: HTTP 500', 500));
		});
	});
});

describe('decodeJwt', () => {
	test('decodes the payload segment of a JWT', () => {
		const payload = { sub: 'user-1', foo: 'bar' };
		const encodedPayload = encodeBase64URL(new TextEncoder().encode(JSON.stringify(payload)).buffer);

		expect(decodeJwt(`header.${encodedPayload}.signature`)).toEqual(payload);
	});

	test('throws a ProtocolError when the payload segment is missing', () => {
		expect(() => decodeJwt('not-a-jwt')).toThrow('Invalid JWT: missing payload segment');
	});

	test('throws a ProtocolError when the payload is not valid base64url', () => {
		expect(() => decodeJwt('header.not!!valid==base64url.signature')).toThrow(ProtocolError);
	});

	test('throws a ProtocolError when the decoded payload is not valid JSON', () => {
		const notJson = encodeBase64URL(new TextEncoder().encode('not-json').buffer);

		expect(() => decodeJwt(`header.${notJson}.signature`)).toThrow(ProtocolError);
	});
});

describe('verifyJwt', () => {
	let keyPair: CryptoKeyPair;

	beforeAll(async () => {
		keyPair = await generateRSAKeyPair();
	});

	test('verifies the signature and returns the payload for a valid RS256 JWT', async () => {
		const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;
		const signingKey = await exportSigningKey(keyPair.publicKey, 'kid-1');

		worker.use(http.get(jwksUri, () => HttpResponse.json({ keys: [signingKey] })));

		const token = await signRS256({ alg: 'RS256', kid: 'kid-1' }, { sub: 'user-1' }, keyPair.privateKey);

		await expect(verifyJwt({ token, jwksUri, options: createOptions() })).resolves.toEqual({ sub: 'user-1' });
	});

	test('selects the sole RS256 key when the JWT header has no kid', async () => {
		const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;
		const signingKey = await exportSigningKey(keyPair.publicKey, 'kid-2');

		worker.use(http.get(jwksUri, () => HttpResponse.json({ keys: [signingKey] })));

		const token = await signRS256({ alg: 'RS256' }, { sub: 'user-2' }, keyPair.privateKey);

		await expect(verifyJwt({ token, jwksUri, options: createOptions() })).resolves.toEqual({ sub: 'user-2' });
	});

	test('uses the first matching key when the JWKS has a duplicate kid, failing closed if that is the wrong one', async () => {
		const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;
		const otherKeyPair = await generateRSAKeyPair();
		const wrongFirstKey = await exportSigningKey(otherKeyPair.publicKey, 'shared-kid');
		const correctSecondKey = await exportSigningKey(keyPair.publicKey, 'shared-kid');

		worker.use(http.get(jwksUri, () => HttpResponse.json({ keys: [wrongFirstKey, correctSecondKey] })));

		const token = await signRS256({ alg: 'RS256', kid: 'shared-kid' }, { sub: 'user-1' }, keyPair.privateKey);

		await expect(verifyJwt({ token, jwksUri, options: createOptions() })).rejects.toThrow('JWT signature verification failed');
	});

	test('rejects a token that does not have exactly 3 segments', async () => {
		await expect(verifyJwt({ token: 'a.b', jwksUri: 'https://brandtegrity.io/jwks.json', options: createOptions() })).rejects.toThrow(
			'Invalid JWT: must have 3 parts',
		);
	});

	test('rejects a token signed with an unsupported algorithm', async () => {
		const header = encodeBase64URL(new TextEncoder().encode(JSON.stringify({ alg: 'HS256' })).buffer);
		const payload = encodeBase64URL(new TextEncoder().encode(JSON.stringify({})).buffer);

		await expect(verifyJwt({ token: `${header}.${payload}.sig`, jwksUri: 'https://brandtegrity.io/jwks.json', options: createOptions() })).rejects.toThrow(
			'Unsupported JWT algorithm: HS256',
		);
	});

	test('rejects when no matching key is found in the JWKS', async () => {
		const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;

		worker.use(http.get(jwksUri, () => HttpResponse.json({ keys: [] })));

		const token = await signRS256({ alg: 'RS256', kid: 'missing-kid' }, {}, keyPair.privateKey);

		await expect(verifyJwt({ token, jwksUri, options: createOptions() })).rejects.toThrow('No matching key found in JWKS for kid: missing-kid');
	});

	test('rejects when the signature was produced by a different key', async () => {
		const jwksUri = `https://brandtegrity.io/jwks/${crypto.randomUUID()}.json`;
		const signingKey = await exportSigningKey(keyPair.publicKey, 'kid-3');

		worker.use(http.get(jwksUri, () => HttpResponse.json({ keys: [signingKey] })));

		const otherKeyPair = await generateRSAKeyPair();
		const token = await signRS256({ alg: 'RS256', kid: 'kid-3' }, {}, otherKeyPair.privateKey);

		await expect(verifyJwt({ token, jwksUri, options: createOptions() })).rejects.toThrow('JWT signature verification failed');
	});
});

describe('generateJwt', () => {
	test('returns an unsigned token with a placeholder signature when no private key is provided', async () => {
		const token = await generateJwt({ alg: 'none' }, { sub: 'user-1' });
		const [header, , signature] = token.split('.');

		expect(signature).toBe('signature');
		expect(decodeJwt(token)).toEqual({ sub: 'user-1' });
		expect(JSON.parse(new TextDecoder().decode(decodeBase64URL(header)))).toEqual({ alg: 'none' });
	});

	test('signs the token with ECDSA when a private key is provided', async () => {
		const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
		const token = await generateJwt({ alg: 'ES256' }, { sub: 'user-1' }, keyPair.privateKey);
		const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

		const valid = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: { name: 'SHA-256' } },
			keyPair.publicKey,
			decodeBase64URL(encodedSignature),
			new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
		);

		expect(valid).toBe(true);
	});
});

describe('verifyIdToken', () => {
	test('returns the decoded claims for a valid ID token', async () => {
		const claims = buildIdTokenClaims();
		const idToken = buildIdToken(claims);

		await expect(verifyIdToken({ idToken, options: createOptions() })).resolves.toEqual(claims);
	});

	test('verifies the signature when verifySignature is true', async () => {
		const keyPair = await generateRSAKeyPair();
		const signingKey = await exportSigningKey(keyPair.publicKey, 'id-token-kid');

		worker.use(http.get('https://brandtegrity.io/.well-known/jwks.json', () => HttpResponse.json({ keys: [signingKey] })));

		const claims = buildIdTokenClaims();
		const idToken = await signRS256({ alg: 'RS256', kid: 'id-token-kid' }, claims, keyPair.privateKey);

		await expect(verifyIdToken({ idToken, options: createOptions(), verifySignature: true })).resolves.toEqual(claims);
	});

	describe('error handling', () => {
		test('throws a ProtocolError when iss does not match the issuer', async () => {
			const idToken = buildIdToken(buildIdTokenClaims({ iss: 'https://impostor.example.com/' }));

			await expect(verifyIdToken({ idToken, options: createOptions() })).rejects.toThrow('Invalid iss');
		});

		test('throws a ProtocolError when aud does not include the client id', async () => {
			const idToken = buildIdToken(buildIdTokenClaims({ aud: 'other-client' }));

			await expect(verifyIdToken({ idToken, options: createOptions() })).rejects.toThrow('Invalid aud');
		});

		test('throws a ProtocolError when sub is missing', async () => {
			const claims = { ...buildIdTokenClaims(), sub: undefined } as unknown as IdTokenClaims;
			const idToken = buildIdToken(claims);

			await expect(verifyIdToken({ idToken, options: createOptions() })).rejects.toThrow('Invalid sub');
		});

		test('throws a ProtocolError when sub does not match the expected subject', async () => {
			const idToken = buildIdToken(buildIdTokenClaims({ sub: 'user-1' }));

			await expect(verifyIdToken({ idToken, options: createOptions(), expectedSub: 'user-2' })).rejects.toThrow('Invalid sub');
		});

		test('throws a ProtocolError when the nonce does not match the expected nonce', async () => {
			const idToken = buildIdToken(buildIdTokenClaims({ nonce: 'actual-nonce' }));

			await expect(verifyIdToken({ idToken, options: createOptions(), expectedNonce: 'expected-nonce' })).rejects.toThrow('Invalid nonce');
		});

		test('throws a ProtocolError when a nonce is expected but the token has none', async () => {
			const idToken = buildIdToken(buildIdTokenClaims());

			await expect(verifyIdToken({ idToken, options: createOptions(), expectedNonce: 'expected-nonce' })).rejects.toThrow('Invalid nonce');
		});

		test("throws a ProtocolError when the token carries another journey's nonce", async () => {
			const idToken = buildIdToken(buildIdTokenClaims({ nonce: 'journey-a-nonce' }));

			await expect(verifyIdToken({ idToken, options: createOptions(), expectedNonce: 'journey-b-nonce' })).rejects.toThrow('Invalid nonce');
		});
	});
});

describe('exchangeCode', () => {
	test('sends exactly the 5 required fields in the token request body', async () => {
		const options = createOptions();
		const stateData = await getMockStorage(options.stateStorage).generateState();
		let capturedBody: URLSearchParams | undefined;
		worker.use(
			http.post('https://brandtegrity.io/oauth2/token', async ({ request }) => {
				capturedBody = new URLSearchParams(await request.text());

				return HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 });
			}),
		);

		await exchangeCode({ params: { code: 'abc123', state: stateData.id }, options });

		expect(Array.from(capturedBody!.keys()).sort()).toEqual(['client_id', 'code', 'code_verifier', 'grant_type', 'redirect_uri']);
		expect(capturedBody?.get('grant_type')).toBe('authorization_code');
		expect(capturedBody?.get('code_verifier')).toBe(stateData.codeVerifier);
	});

	test.each(['bearer', 'BEARER', 'Bearer'])('accepts a case-insensitive token_type "%s"', async (tokenType) => {
		const options = createOptions();
		const stateData = await getMockStorage(options.stateStorage).generateState();
		worker.use(
			http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: tokenType, expires_in: 3600 })),
		);

		await expect(exchangeCode({ params: { code: 'abc123', state: stateData.id }, options })).resolves.toMatchObject({ access_token: 'access-token' });
	});

	test.each(['MAC', 'DPoP'])('rejects an unsupported token_type "%s"', async (tokenType) => {
		const options = createOptions();
		const stateData = await getMockStorage(options.stateStorage).generateState();
		worker.use(
			http.post('https://brandtegrity.io/oauth2/token', () => HttpResponse.json({ access_token: 'access-token', token_type: tokenType, expires_in: 3600 })),
		);

		await expect(exchangeCode({ params: { code: 'abc123', state: stateData.id }, options })).rejects.toThrow(`Unsupported token_type: ${tokenType}`);
	});

	test.each([
		['omitted', undefined],
		['a string', '3600'],
		['zero', 0],
		['negative', -1],
	])('does not crash when expires_in is %s', async (_label, expiresIn) => {
		const options = createOptions();
		const stateData = await getMockStorage(options.stateStorage).generateState();
		worker.use(
			http.post('https://brandtegrity.io/oauth2/token', () =>
				HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', ...(expiresIn === undefined ? {} : { expires_in: expiresIn }) }),
			),
		);

		await expect(exchangeCode({ params: { code: 'abc123', state: stateData.id }, options })).resolves.toMatchObject({ access_token: 'access-token' });
	});

	test('records a narrower granted scope rather than assuming it equals the requested scope', async () => {
		const options = createOptions({ scopes: ['openid', 'profile', 'email'] });
		const stateData = await getMockStorage(options.stateStorage).generateState();
		worker.use(
			http.post('https://brandtegrity.io/oauth2/token', () =>
				HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600, scope: 'openid' }),
			),
		);

		await expect(exchangeCode({ params: { code: 'abc123', state: stateData.id }, options })).resolves.toMatchObject({ scope: 'openid' });
	});
});

describe('refreshToken', () => {
	test('includes audience and scope in the token request when provided', async () => {
		let capturedBody: URLSearchParams | undefined;

		worker.use(
			http.post('https://brandtegrity.io/oauth2/token', async ({ request }) => {
				capturedBody = new URLSearchParams(await request.text());

				return HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 });
			}),
		);

		await refreshToken({ refreshToken: 'refresh-token', options: createOptions(), audience: 'https://api.example.com', scope: 'openid profile' });

		expect(capturedBody?.get('audience')).toBe('https://api.example.com');
		expect(capturedBody?.get('scope')).toBe('openid profile');
	});

	test('omits audience and scope from the token request when not provided', async () => {
		let capturedBody: URLSearchParams | undefined;

		worker.use(
			http.post('https://brandtegrity.io/oauth2/token', async ({ request }) => {
				capturedBody = new URLSearchParams(await request.text());

				return HttpResponse.json({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 });
			}),
		);

		await refreshToken({ refreshToken: 'refresh-token', options: createOptions() });

		expect(capturedBody?.has('audience')).toBe(false);
		expect(capturedBody?.has('scope')).toBe(false);
	});

	test('replaces the refresh token when the response includes a new one', async () => {
		worker.use(
			http.post('https://brandtegrity.io/oauth2/token', () =>
				HttpResponse.json({ access_token: 'new-access-token', refresh_token: 'new-refresh-token', token_type: 'Bearer', expires_in: 3600 }),
			),
		);

		await expect(refreshToken({ refreshToken: 'old-refresh-token', options: createOptions() })).resolves.toMatchObject({ refresh_token: 'new-refresh-token' });
	});
});
