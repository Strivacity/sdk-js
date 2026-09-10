import type { ExtraRequestArgs, IdTokenClaims, DiscoveryDocument, SDKOptions, SessionData, EntryResponse, FlowState, SigningKey } from '../types/oidc';
import type { NativeFlowState } from '../types/native';
import { decodeBase64URL, encodeBase64URL } from './base64url';
import { FallbackError, SessionExpiredError, OidcError, ProtocolError, ServerError, NetworkError, throwHttpError, throwTokenEndpointError } from './errors';
import { createHttpClient } from './httpClient';
import { createSession } from './session';
import { createState, parseState, serializeState } from './state';
import { redirectUrlHandler, redirectCallbackHandler } from '../handlers/redirect';
import { createLocalStorage } from '../storages/local';
import { createSessionStorage } from '../storages/session';
import { timestamp } from './common';

/**
 * Stores the expiration timestamp of the cached OpenID configuration discovery document.
 */
let discoveryDocumentCacheExpiresAt = 0;

/**
 * A promise that represents the ongoing fetch of the OpenID configuration discovery document.
 */
let discoveryDocumentFetchPromise: Promise<DiscoveryDocument> | null = null;

/**
 * OpenID configuration discovery document cache.
 */
let discoveryDocument: DiscoveryDocument | null = null;

/**
 * JSON Web Key Set (JWKS) cache.
 */
const jwksCache = new Map<string, { keys: Array<SigningKey>; expiresAt: number }>();

/**
 * Returns the default flow state for the SDK.
 *
 * @returns {FlowState} The default flow state object.
 */
export function getDefaultFlowState(): FlowState {
	return {
		initialized: false,
		session: null,
		sessionId: null,
		shortAppId: null,
		language: globalThis.navigator?.language ?? 'en-US',
	};
}

/**
 * Returns the default SDK options for the SDK.
 */
export const defaultOptions: Partial<SDKOptions> = {
	lazyLoad: false,
	autoRefresh: true,
	serverSessionUri: null,
	scopes: ['openid'],
	responseType: 'code',
	responseMode: 'query',
	storageTokenName: 'sty.session',
	discoveryDocumentCacheTTL: 3600,
	jwksCacheTTL: 600,
} as const;

/**
 * Fetches the OpenID configuration discovery document from the authorization server.
 * Caches the document for a specified duration to avoid unnecessary network requests.
 *
 * @param {SDKOptions} options - The SDK options containing the issuer URL and other configurations.
 * @returns {Promise<DiscoveryDocument>} A promise that resolves to the fetched discovery document.
 * @throws {ServerError} If the discovery document fetch fails with a server error (HTTP 429 or 5xx).
 * @throws {ProtocolError} If the discovery document is missing required fields or has an issuer mismatch.
 */
export async function getDiscoveryDocument(options: SDKOptions): Promise<DiscoveryDocument> {
	if (discoveryDocument && discoveryDocumentCacheExpiresAt > timestamp()) {
		return discoveryDocument;
	}

	if (discoveryDocumentFetchPromise) {
		return discoveryDocumentFetchPromise;
	}

	discoveryDocumentFetchPromise = (async () => {
		try {
			const response = await options.httpClient.request<DiscoveryDocument>(new URL('/.well-known/openid-configuration', options.issuer));

			if (!response.ok) {
				throw new ServerError(`Failed to fetch OIDC metadata`, response.status);
			}

			let metadata: DiscoveryDocument;

			try {
				metadata = await response.json();
			} catch {
				throw new ProtocolError('Non-JSON response from discovery document endpoint');
			}

			if (metadata.issuer?.replace(/\/$/, '') !== options.issuer.replace(/\/$/, '')) {
				throw new ProtocolError(`Discovery document issuer mismatch: expected ${options.issuer}, got ${metadata.issuer}`);
			}

			const issuerHost = new URL(options.issuer).host;

			for (const field of ['authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const) {
				const endpoint = metadata[field];

				if (!endpoint) {
					throw new ProtocolError(`Discovery document is missing required field: ${field}`);
				}

				const endpointUrl = new URL(endpoint);

				if (endpointUrl.protocol !== 'https:' || endpointUrl.host !== issuerHost) {
					throw new ProtocolError(`Discovery document field "${field}" must be an https:// URL on ${issuerHost}, got ${endpoint}`);
				}
			}

			for (const field of ['end_session_endpoint', 'revocation_endpoint'] as const) {
				const endpoint = metadata[field];

				if (!endpoint) {
					continue;
				}

				const endpointUrl = new URL(endpoint);

				if (endpointUrl.protocol !== 'https:' || endpointUrl.host !== issuerHost) {
					throw new ProtocolError(`Discovery document field "${field}" must be an https:// URL on ${issuerHost}, got ${endpoint}`);
				}
			}

			if (!metadata.code_challenge_methods_supported?.includes('S256')) {
				throw new ProtocolError('Discovery document does not advertise S256 PKCE support');
			}

			discoveryDocument = metadata;
			discoveryDocumentCacheExpiresAt = timestamp() + options.discoveryDocumentCacheTTL;

			return metadata;
		} finally {
			discoveryDocumentFetchPromise = null;
		}
	})();

	return discoveryDocumentFetchPromise;
}

/**
 * Returns the JWKS for the given URI, from cache unless it's stale or `forceRefresh` is set.
 *
 * @param {Object} options - The options for fetching the JWKS.
 * @param {string} options.jwksUri - The URL of the JWKS endpoint.
 * @param {SDKOptions} options.options - The SDK options containing client ID, storage, and other options.
 * @param {boolean} [options.forceRefresh=false] - Bypasses the cache and fetches a fresh key set.
 * @returns {Promise<{ keys: Array<SigningKey> }>} The (possibly cached) key set.
 * @throws {NetworkError} If the JWKS fetch fails due to network issues.
 * @throws {ServerError} If the JWKS fetch fails with a server error (HTTP 429 or 5xx).
 */
async function getJwks({
	jwksUri,
	options,
	forceRefresh = false,
}: {
	jwksUri: string;
	options: SDKOptions;
	forceRefresh?: boolean;
}): Promise<{ keys: Array<SigningKey> }> {
	const cached = jwksCache.get(jwksUri);

	if (!forceRefresh && cached && cached.expiresAt > timestamp()) {
		return { keys: cached.keys };
	}

	let jwksResponse: Response;

	try {
		jwksResponse = await fetch(jwksUri);
	} catch {
		throw new NetworkError(`Failed to fetch JWKS: ${jwksUri}`);
	}

	if (!jwksResponse.ok) {
		throw new ServerError(`Failed to fetch JWKS: HTTP ${jwksResponse.status}`, jwksResponse.status);
	}

	const jwks = (await jwksResponse.json()) as { keys: Array<SigningKey> };

	jwksCache.set(jwksUri, { keys: jwks.keys, expiresAt: timestamp() + options.jwksCacheTTL });

	return jwks;
}

/**
 * Returns with the SDK options merged with the provided options.
 *
 * @param {SDKInitConfig} options - The SDK initialization configuration.
 * @template InitOptions - The type of the SDK initialization configuration.
 * @template Options - The type of the SDK options.
 * @returns {Options} The merged SDK options.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSDKOptions<Options extends SDKOptions = SDKOptions>(options: any): Options {
	options.issuer = options.issuer.endsWith('/') ? options.issuer.slice(0, -1) : options.issuer;
	options.storage ??= createLocalStorage();
	options.stateStorage ??= createSessionStorage();
	options.httpClient ??= createHttpClient(options.logging);
	options.urlHandler ??= redirectUrlHandler;
	options.callbackHandler ??= redirectCallbackHandler;
	options.lazyLoad ??= defaultOptions.lazyLoad;
	options.autoRefresh ??= defaultOptions.autoRefresh;
	options.serverSessionUri ??= defaultOptions.serverSessionUri;

	options.scopes ??= defaultOptions.scopes;
	options.responseType ??= defaultOptions.responseType;
	options.responseMode ??= defaultOptions.responseMode;
	options.storageTokenName ??= defaultOptions.storageTokenName;
	options.discoveryDocumentCacheTTL ??= defaultOptions.discoveryDocumentCacheTTL;
	options.jwksCacheTTL ??= defaultOptions.jwksCacheTTL;

	return options;
}

/**
 * Generates a code verifier for PKCE (Proof Key for Code Exchange).
 *
 * @returns {string} A randomly generated code verifier string.
 */
export function generateCodeVerifier(): string {
	const bytes = new Uint8Array(32);

	globalThis.crypto.getRandomValues(bytes);

	return encodeBase64URL(bytes.buffer);
}

/**
 * Generates a code challenge from a code verifier using SHA-256 hashing.
 *
 * @param {string} codeVerifier The code verifier string.
 * @returns {Promise<string>} A promise that resolves to the generated code challenge.
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
	const encoded = new TextEncoder().encode(codeVerifier);
	const hash = await globalThis.crypto.subtle.digest('SHA-256', encoded);

	return encodeBase64URL(hash);
}

/**
 * Generates a random hexadecimal string of the specified byte length.
 *
 * @param {number} [byteLength=16] - The number of random bytes to generate (default is 16).
 * @returns {string} A randomly generated hexadecimal string.
 */
export function generateRandomHex(byteLength = 16): string {
	const bytes = new Uint8Array(byteLength);

	globalThis.crypto.getRandomValues(bytes);

	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Decodes a JWT token and returns the payload as an object.
 *
 * @template T The expected structure of the JWT payload.
 * @param {string} token - The JWT token to decode.
 * @returns {T} The decoded payload of the JWT token.
 * @throws {ProtocolError} If the token is invalid or has the wrong format.
 */
export function decodeJwt<T = Record<string, unknown>>(token: string): T {
	const [, payload] = token.split('.');

	if (!payload) {
		throw new ProtocolError('Invalid JWT: missing payload segment');
	}

	try {
		return JSON.parse(new TextDecoder().decode(decodeBase64URL(payload))) as T;
	} catch {
		throw new ProtocolError('Invalid JWT: payload is not valid base64url-encoded JSON');
	}
}

/**
 * Verifies a JWT token's signature against a JWKS endpoint.
 * Only RS256 is supported.
 *
 * @param {Object} options - The options for verifying the JWT.
 * @param {string} options.token - The JWT token to verify.
 * @param {string} options.jwksUri - The URL of the JWKS endpoint.
 * @param {SDKOptions} options.options - The SDK options containing client ID, storage, and other options.
 * @template T - The expected structure of the JWT payload.
 * @returns {Promise<T>} The verified payload.
 * @throws {ProtocolError} If the token is invalid, the key is not found, or verification fails.
 */
export async function verifyJwt<T = Record<string, unknown>>({ token, jwksUri, options }: { token: string; jwksUri: string; options: SDKOptions }): Promise<T> {
	const parts = token.split('.');

	if (parts.length !== 3) {
		throw new ProtocolError('Invalid JWT: must have 3 parts');
	}

	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	const header = JSON.parse(new TextDecoder().decode(decodeBase64URL(encodedHeader))) as { kid?: string; alg?: string };

	if (header.alg !== 'RS256') {
		throw new ProtocolError(`Unsupported JWT algorithm: ${header.alg}`);
	}

	let jwks = await getJwks({ jwksUri, options });
	let signingKey = header.kid ? jwks.keys.find((k) => k.kid === header.kid) : jwks.keys.find((k) => k.alg === 'RS256');

	if (!signingKey && header.kid) {
		jwks = await getJwks({ jwksUri, options, forceRefresh: true });
		signingKey = jwks.keys.find((k) => k.kid === header.kid);
	}

	if (!signingKey) {
		throw new ProtocolError(`No matching key found in JWKS${header.kid ? ` for kid: ${header.kid}` : ''}`);
	}

	const cryptoKey = await globalThis.crypto.subtle.importKey(
		'jwk',
		{ kty: signingKey.kty, n: signingKey.n, e: signingKey.e, alg: signingKey.alg, use: signingKey.use },
		{ name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
		false,
		['verify'],
	);
	const signature = decodeBase64URL(encodedSignature);
	const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
	const valid = await globalThis.crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, cryptoKey, signature, data);

	if (!valid) {
		throw new ProtocolError('JWT signature verification failed');
	}

	return JSON.parse(new TextDecoder().decode(decodeBase64URL(encodedPayload))) as T;
}

/**
 * Generates a signed JWT token using the provided header, payload, and private key.
 *
 * @param {object} header - The JWT header.
 * @param {object} payload - The JWT payload.
 * @param {CryptoKey} [privateKey] - The private key to sign the JWT. If not provided, an unsigned token will be generated.
 * @returns {Promise<string>} A promise that resolves to the signed JWT token.
 */
export async function generateJwt(header: object, payload: object, privateKey?: CryptoKey): Promise<string> {
	const encodedHeader = encodeBase64URL(new TextEncoder().encode(JSON.stringify(header)).buffer);
	const encodedPayload = encodeBase64URL(new TextEncoder().encode(JSON.stringify(payload)).buffer);
	const encodedToken = `${encodedHeader}.${encodedPayload}`;

	if (privateKey) {
		const signature = await globalThis.crypto.subtle.sign(
			{
				name: 'ECDSA',
				hash: { name: 'SHA-256' },
			},
			privateKey,
			new TextEncoder().encode(encodedToken),
		);

		return `${encodedToken}.${encodeBase64URL(signature)}`;
	}

	return `${encodedToken}.signature`;
}

/**
 * Verifies and validates an ID token's claims.
 *
 * @param {Object} options - The options for verifying the ID token
 * @param {string} options.idToken - The ID token to verify
 * @param {SDKOptions} options.options - The SDK options containing client ID, storage, and other options
 * @param {string} [options.expectedSub] - Optional expected subject (`sub`) claim to validate against the ID token
 * @param {string} [options.expectedNonce] - Optional expected nonce claim to validate against the ID token
 * @returns {Promise<IdTokenClaims>} The verified, validated claims.
 * @throws {ProtocolError} If the signature, `iss`, `aud`, `exp`, or `sub` fail validation.
 */
export async function verifyIdToken({
	idToken,
	options,
	verifySignature = false,
	expectedSub,
	expectedNonce,
}: {
	idToken: string;
	options: SDKOptions;
	verifySignature?: boolean;
	expectedSub?: string;
	expectedNonce?: string;
}): Promise<IdTokenClaims> {
	const metadata = await getDiscoveryDocument(options);
	const claims = verifySignature ? await verifyJwt<IdTokenClaims>({ token: idToken, options, jwksUri: metadata.jwks_uri }) : decodeJwt<IdTokenClaims>(idToken);
	const now = timestamp();

	if (claims?.iss !== metadata.issuer) {
		throw new ProtocolError('Invalid iss');
	}
	if (Array.isArray(claims?.aud) ? !claims.aud.includes(options.clientId) : claims?.aud !== options.clientId) {
		throw new ProtocolError('Invalid aud');
	}
	if (!claims?.exp || claims.exp <= now) {
		throw new ProtocolError('Token has expired');
	}
	if (!claims?.sub || (expectedSub && claims.sub !== expectedSub)) {
		throw new ProtocolError('Invalid sub');
	}
	if (expectedNonce && claims?.nonce !== expectedNonce) {
		throw new ProtocolError('Invalid nonce');
	}

	return claims;
}

/**
 * Builds the authorization URL with the provided parameters and configuration.
 *
 * @param {Object} options - The options for building the login URL and starting the session
 * @param {ExtraRequestArgs} options.params - The parameters for the authorization request, including optional prompts and hints
 * @param {SDKOptions} options.options - The SDK options containing client ID, redirect URI, storage, and other options
 * @returns {Promise<URL>} A promise that resolves to the constructed authorization URL
 * @throws {Error} If fetching OIDC metadata fails or writing the PKCE state to storage fails.
 */
export async function buildAuthorizationUrl<URLHandlerParams extends ExtraRequestArgs = ExtraRequestArgs>({
	url,
	includeOAuthParams = true,
	persistState = true,
	params,
	options,
}: {
	url?: string | null | URL;
	includeOAuthParams?: boolean;
	persistState?: boolean;
	params: URLHandlerParams;
	options: SDKOptions;
}): Promise<URL> {
	const stateData = await createState();
	stateData.metadata = {};

	if (!url) {
		const metadata = await getDiscoveryDocument(options);
		url = new URL(metadata.authorization_endpoint);
	}
	if (typeof url === 'string') {
		url = new URL(url, globalThis.location.origin);
	}

	if (includeOAuthParams) {
		const scopes = new Set(options.scopes ?? ['openid']);

		url.searchParams.set('client_id', options.clientId);
		url.searchParams.set('redirect_uri', options.redirectUri);
		url.searchParams.set('response_type', options.responseType ?? 'code');
		url.searchParams.set('response_mode', options.responseMode ?? 'query');
		url.searchParams.set('scope', Array.from(scopes).join(' '));
		url.searchParams.set('code_challenge_method', 'S256');
		url.searchParams.set('state', stateData.id);
		url.searchParams.set('code_challenge', stateData.codeChallenge);

		if (scopes.has('openid')) {
			url.searchParams.set('nonce', stateData.nonce);
		}
	}

	if (params.prompt) {
		url.searchParams.set('prompt', params.prompt);
		stateData.metadata.prompt = params.prompt;
	}
	if (params.display) {
		url.searchParams.set('display', params.display);
		stateData.metadata.display = params.display;
	}
	if (params.loginHint) {
		url.searchParams.set('login_hint', params.loginHint);
		stateData.metadata.loginHint = params.loginHint;
	}
	if (params.acrValues?.length) {
		const acrValues = params.acrValues.filter(Boolean);

		if (acrValues.length) {
			url.searchParams.set('acr_values', acrValues.join(' '));
			stateData.metadata.acrValues = acrValues;
		}
	}
	if (params.uiLocales?.length) {
		const uiLocales = params.uiLocales.filter(Boolean);

		if (uiLocales.length) {
			url.searchParams.set('ui_locales', uiLocales.join(' '));
			stateData.metadata.uiLocales = uiLocales;
		}
	}
	if (params.audiences?.length) {
		const audiences = params.audiences.filter(Boolean);

		if (audiences.length) {
			url.searchParams.set('audience', audiences.join(' '));
			stateData.metadata.audiences = audiences;
		}
	}

	if (persistState) {
		await options.stateStorage.set(`sty.${stateData.id}`, serializeState(stateData));
	}

	return url;
}

/**
 * Builds the end session (logout) URL with optional parameters for ID token hint and post-logout redirect URI.
 *
 * @param {Object} options - The options for building the end session URL
 * @param {string | URL} options.url - The base URL for the end session endpoint
 * @param {string} options.idToken - The ID token to include as a hint for the end session request
 * @param {string} [options.postLogoutRedirectUri] - Optional URI to redirect to after logout
 * @returns {URL} A promise that resolves to the constructed end session URL
 * @throws {Error} If fetching metadata fails or the end session endpoint is not available
 */
export function buildEndSessionUrl({ url, idToken, postLogoutRedirectUri }: { url: string | URL; idToken: string; postLogoutRedirectUri?: string }): URL {
	const endSessionUrl = new URL(url);

	endSessionUrl.searchParams.set('id_token_hint', idToken);

	if (postLogoutRedirectUri) {
		endSessionUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
	}

	return endSessionUrl;
}

/**
 * Exchanges an authorization code for tokens by sending a request to the token endpoint.
 * Validates the PKCE state and ID token claims, and returns the session data.
 *
 * @param {Object} options - The options for exchanging the authorization code
 * @param {string | URL} [options.url] - The token endpoint URL (optional, will be fetched from metadata if not provided)
 * @param {Record<string, string>} options.params - The parameters received from the authorization server, including the authorization code and state
 * @param {SDKOptions} options.options - The SDK options containing client ID, redirect URI, storage, and other options
 * @returns {Promise<SessionData>} A promise that resolves to the session data containing tokens and claims
 * @throws {OidcError} If the token endpoint returns an OIDC error response
 * @throws {ServerError} If the token endpoint request fails with a server error (HTTP 429 or 5xx)
 * @throws {NetworkError} If the token endpoint request fails due to network issues
 * @throws {ProtocolError} If the authorization code or state is invalid, or if the token endpoint returns an error
 * @throws {ProtocolError} If the authorization code or state is invalid, or if the token endpoint returns an error
 */
export async function exchangeCode({
	url,
	params,
	options,
}: {
	url?: string | URL;
	params: Record<string, string>;
	options: SDKOptions;
}): Promise<SessionData> {
	const session = createSession(params);

	if (session.error) {
		throw new OidcError(session.error, session.error_description, session.error_uri);
	}
	if (!session.code) {
		throw new ProtocolError('Invalid or missing authorization code');
	}

	const stateKey = `sty.${session.state}`;
	const serializedState = await options.stateStorage.get(stateKey);

	if (!serializedState) {
		throw new ProtocolError('Invalid or missing state');
	}

	let state;

	try {
		state = parseState(serializedState);
	} catch {
		throw new ProtocolError('Invalid or missing state');
	}

	await options.stateStorage.delete(stateKey);

	const metadata = await getDiscoveryDocument(options);
	const tokenUrl = url ?? metadata.token_endpoint;
	const response = await options.httpClient.sendTokenRequest<Record<string, string>>(tokenUrl, {
		grant_type: 'authorization_code',
		client_id: options.clientId,
		redirect_uri: options.redirectUri,
		code_verifier: state.codeVerifier,
		code: session.code,
	});

	if (!response.ok) {
		await throwTokenEndpointError(response);
	}

	let data: Record<string, string>;

	try {
		data = await response.json();
	} catch {
		throw new ProtocolError('Non-JSON response from token endpoint');
	}

	const updatedSession: SessionData = { ...params, ...createSession(data) };

	if (updatedSession.error) {
		throw new OidcError(updatedSession.error, updatedSession.error_description, updatedSession.error_uri);
	}

	if (updatedSession.id_token) {
		updatedSession.claims = await verifyIdToken({ idToken: updatedSession.id_token, expectedNonce: state.nonce, options });
	}

	return updatedSession;
}

/**
 * Refreshes the access token using the stored refresh token and persists the updated session.
 *
 * @param {Object} options - The options for refreshing the access token
 * @param {string} options.url - The token endpoint URL
 * @param {string} options.refreshToken - The refresh token to use for refreshing the access token
 * @param {SDKOptions} options.options - The SDK options containing client ID, storage, and other options
 * @param {string} [options.grantType='refresh_token'] - The grant type to use for the token refresh request (default is 'refresh_token')
 * @param {string} [options.clientId] - Optional client ID to override the default client ID in the SDK options
 * @param {string} [options.audience] - Optional audience to include in the token refresh request
 * @param {string} [options.scope] - Optional scope to include in the token refresh request
 * @returns {Promise<SessionData>} A promise that resolves to the updated session data with refreshed tokens
 * @throws {ServerError} If the token refresh request fails with a server error (HTTP 429 or 5xx)
 * @throws {NetworkError} If the token refresh request fails due to network issues
 * @throws {OidcError} If the token refresh request returns an OIDC error response
 * @throws {ProtocolError} If the token refresh request returns an error or the ID token claims are invalid
 */
export async function refreshToken({
	url,
	refreshToken,
	options,
	grantType = 'refresh_token',
	clientId,
	audience,
	scope,
	expectedSub,
}: {
	url?: string | URL;
	refreshToken: string;
	options: SDKOptions;
	grantType?: string;
	clientId?: string;
	audience?: string;
	scope?: string;
	expectedSub?: string;
}): Promise<SessionData> {
	const params: Record<string, string> = {
		grant_type: grantType,
		client_id: clientId ?? options.clientId,
		refresh_token: refreshToken,
	};

	if (audience) {
		params.audience = audience;
	}

	if (scope) {
		params.scope = scope;
	}

	const metadata = await getDiscoveryDocument(options);
	const refreshUrl = url ?? metadata.token_endpoint;
	const response = await options.httpClient.sendTokenRequest<Record<string, string>>(refreshUrl, params);

	if (!response.ok) {
		await throwTokenEndpointError(response);
	}

	let data: Record<string, string>;

	try {
		data = await response.json();
	} catch {
		throw new ProtocolError('Non-JSON response from token endpoint');
	}

	const updatedSession: SessionData = createSession(data);

	if (updatedSession.error) {
		throw new OidcError(updatedSession.error, updatedSession.error_description, updatedSession.error_uri);
	}

	if (updatedSession.id_token) {
		updatedSession.claims = await verifyIdToken({ idToken: updatedSession.id_token, expectedSub, options });
	}

	return updatedSession;
}

/**
 * Revokes the best available token (refresh token preferred, then access token) and removes the session from storage.
 *
 * @param {Object} options - The options for revoking the token
 * @param {string | URL} options.url - The revocation endpoint URL
 * @param {string} options.tokenTypeHint - The type of token to revoke ('refresh_token' or 'access_token')
 * @param {string} options.token - The token to revoke
 * @param {SDKOptions} options.options - The SDK options containing client ID, storage, and other options
 * @param {string} [options.clientId] - Optional client ID to override the default client ID in the SDK options
 * @returns {Promise<void>} A promise that resolves when the token is revoked and the session is cleared from storage
 * @throws {ServerError} If the token revocation request fails with a server error (HTTP 429 or 5xx)
 * @throws {ProtocolError} If the token revocation request returns an error or the ID token claims are invalid
 */
export async function revokeToken({
	url,
	tokenTypeHint,
	token,
	options,
	clientId,
}: {
	url?: string | URL;
	tokenTypeHint: string;
	token: string;
	options: SDKOptions;
	clientId?: string;
}): Promise<void> {
	const metadata = await getDiscoveryDocument(options);
	const revokeUrl = url ?? metadata.revocation_endpoint;

	if (!revokeUrl) {
		options.logging?.debug('Revocation skipped: no revocation_endpoint available');
		return;
	}

	const response = await options.httpClient.sendTokenRequest<Record<string, string>>(revokeUrl, {
		client_id: clientId ?? options.clientId,
		token_type_hint: tokenTypeHint,
		token,
	});

	if (response && !response.ok) {
		await throwTokenEndpointError(response);
	}
}

/**
 * Fetches the entry flow from the specified URL with the provided parameters and SDK options.
 *
 * @param {Object} options
 * @param {string | URL} options.url - The URL to request the entry flow from
 * @param {URLSearchParams} options.params - The parameters to include in the entry request
 * @param {SDKOptions} options.options - The SDK options containing client ID, redirect URI, storage, and other options
 * @param {string} [options.clientId] - Optional client ID to override the default client ID in the SDK options
 * @param {string} [options.redirectUri] - Optional redirect URI to override the default redirect URI in the SDK options
 * @param {string} [options.sdkMode='web'] - Optional SDK mode to include in the entry request (default is 'web')
 * @returns {Promise<EntryResponse>} A promise resolving to the entry result.
 * @throws {OidcError} If the entry request returns an OIDC error response.
 * @throws {ServerError} If the entry request fails with a server error (HTTP 429 or 5xx).
 * @throws {ProtocolError} If the entry request fails with a protocol error or missing required fields.
 */
export async function fetchFlowEntry({
	url,
	params,
	options,
	clientId,
	redirectUri,
	sdkMode = 'web',
}: {
	url: string | URL;
	params: URLSearchParams;
	options: SDKOptions;
	clientId?: string;
	redirectUri?: string;
	sdkMode?: string;
}): Promise<EntryResponse> {
	params.set('sdk', sdkMode);
	params.set('client_id', clientId ?? options.clientId);
	params.set('redirect_uri', redirectUri ?? options.redirectUri);

	const requestUrl = new URL(url);
	requestUrl.search = params.toString();

	const response = await options.httpClient.request<string | Record<string, string>>(requestUrl);

	if (!response.ok) {
		if (response.status === 400) {
			const data = await response.json();

			if (data && typeof data === 'object') {
				if (data.error) {
					throw new OidcError(data.error, data.error_description, data.error_uri);
				} else if (data.errorKey) {
					throw new ProtocolError(data.errorKey);
				}
			}

			throw new ProtocolError('Entry request failed');
		}

		throwHttpError(response.status, 'Entry request failed');
	}

	let uri: URL;
	let searchParams: Record<string, string>;

	try {
		uri = new URL(await response.text());
		searchParams = Object.fromEntries(uri.searchParams.entries());
	} catch {
		uri = new URL(response.url);
		searchParams = Object.fromEntries(uri.searchParams.entries());
	}

	const shortAppId = searchParams.short_app_id;
	const sessionId = searchParams.session_id;
	const language = searchParams.language || globalThis.navigator?.language || 'en-US';

	if (!sessionId) {
		throw new ProtocolError('"session_id" is missing from the response');
	}

	return { session_id: sessionId, short_app_id: shortAppId, language };
}

/**
 * Finalizes the login session using the provided url.
 *
 * @param {Object} options - The options for finalizing the session
 * @param {string | URL} options.url - The URL to finalize the session.
 * @param {string} options.sessionId - The session ID to finalize the session with.
 * @param {string} options.language - The language to use for the session.
 * @param {SDKOptions} options.options - The SDK options containing client ID, redirect URI, storage, and other options.
 * @returns {Promise<URL>} A promise that resolves to the redirect URL after finalizing the session.
 * @throws {ServerError} If the request to finalize the session fails with a server error (HTTP 429 or 5xx).
 * @throws {ProtocolError} If the response from the server is invalid or does not contain a valid redirect URI.
 */
export async function finalizeLoginSession({
	url,
	sessionId,
	language,
	options,
}: {
	url: string | URL;
	sessionId: string;
	language: string;
	options: SDKOptions;
}): Promise<URL> {
	const response = await options.httpClient.request(url, {
		method: 'GET',
		credentials: 'include',
		headers: {
			Authorization: `Bearer ${sessionId}`,
			'Accept-language': language,
		},
	});

	if (!response.ok) {
		throwHttpError(response.status, 'Failed to finalize login session');
	}

	let redirectUri: URL;

	try {
		redirectUri = new URL(await response.text());
	} catch {
		throw new ProtocolError('Invalid redirect URI');
	}

	if (!redirectUri.toString().startsWith(options.redirectUri)) {
		throw new ProtocolError('Invalid redirect URI');
	}

	return redirectUri;
}

/**
 * Submits a login form to the authentication server.
 *
 * @param {Object} options - The options for submitting the form.
 * @param {string} [options.formId] - The ID of the form to submit. If not provided, the init endpoint is used.
 * @param {Record<string, unknown>} [options.body] - The form data to include in the request body.
 * @param {string} options.sessionId - The session ID for the current authentication session.
 * @param {string} options.language - The language preference sent in the `Accept-language` header.
 * @param {SDKOptions} options.options - The SDK options.
 * @returns {Promise<NativeFlowState>} A promise that resolves to the current login flow state.
 * @throws {ServerError} If the server returns a non-recoverable HTTP error.
 * @throws {FallbackError} If the server indicates the flow should fall back to the hosted UI.
 * @throws {SessionExpiredError} If the session has expired (HTTP 403).
 */
export async function submitLoginForm({
	formId,
	body,
	sessionId,
	language,
	options,
}: {
	formId?: string;
	body?: Record<string, unknown>;
	sessionId: string;
	language: string;
	options: SDKOptions;
}): Promise<NativeFlowState> {
	const response = await options.httpClient.request<NativeFlowState>(new URL(`/flow/api/v1/${formId ? `form/${formId}` : 'init'}`, options.issuer), {
		method: 'POST',
		credentials: 'include',
		body: JSON.stringify(body),
		headers: {
			Authorization: `Bearer ${sessionId}`,
			'Content-Type': 'application/json',
			'Accept-language': language,
		},
	});
	let data: NativeFlowState = {};

	try {
		data = await response.json();
	} catch {}

	if (!response.ok) {
		if (response.status === 403) {
			throw new SessionExpiredError();
		}

		if (response.status >= 400 && response.status < 500 && data?.hostedUrl && !data.messages) {
			throw new FallbackError(new URL(data.hostedUrl), `Received HTTP ${response.status} without messages`);
		}

		throwHttpError(response.status, 'Failed to submit login form');
	}

	if (data.hostedUrl && !data.finalizeUrl && !data.forms && !data.messages) {
		throw new FallbackError(new URL(data.hostedUrl), 'No forms or messages in response');
	}

	return data;
}
