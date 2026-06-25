import type { SDKHttpClient } from '../types/common';
import type { ExtraRequestArgs, IdTokenClaims, MetadataOptions, SDKOptions, SessionData, EntryResponse, FlowState, SigningKey } from '../types/oidc';
import type { LoginFlowState } from '../types/native';
import { decodeBase64URL, encodeBase64URL } from './base64url';
import { FallbackError } from './errors';
import { createHttpClient } from './httpClient';
import { createSession } from './session';
import { createState, parseState, serializeState } from './state';
import { redirectUrlHandler, redirectCallbackHandler } from '../handlers/redirect';
import { createLocalStorage } from '../storages/local';
import { timestamp } from './common';

/**
 * Returns the default flow state for the SDK.
 *
 * @returns {FlowState} The default flow state object.
 */
export function getDefaultFlowState(): FlowState {
	return { initialized: false, metadata: null, session: null, sessionId: null, shortAppId: null, language: globalThis.navigator?.language ?? 'en-US' };
}

/**
 * Returns the default SDK options for the SDK.
 */
export const defaultOptions: Partial<SDKOptions> = {
	lazyLoad: false,
	autoRefresh: true,
	serverSideSession: false,
	loginUri: '/login',
	scopes: ['openid'],
	responseType: 'code',
	responseMode: 'query',
	storageTokenName: 'sty.session',
};

/**
 * Returns with the SDK options merged with the provided options.
 *
 * @param {FlowState} state - The current flow state.
 * @param {SDKInitConfig} options - The SDK initialization configuration.
 * @template InitOptions - The type of the SDK initialization configuration.
 * @template Options - The type of the SDK options.
 * @returns {Options} The merged SDK options.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSDKOptions<Options extends SDKOptions = SDKOptions>(state: FlowState, options: any): Options {
	// NOTE: Ensure the issuer URL not ends with a trailing slash
	options.issuer = options.issuer.endsWith('/') ? options.issuer.slice(0, -1) : options.issuer;
	options.storage ??= createLocalStorage();
	options.stateStorage ??= options.storage;
	options.httpClient ??= createHttpClient(options.logging);
	options.urlHandler ??= redirectUrlHandler;
	options.callbackHandler ??= redirectCallbackHandler;
	options.lazyLoad ??= defaultOptions.lazyLoad;
	options.autoRefresh ??= defaultOptions.autoRefresh;
	options.serverSideSession ??= defaultOptions.serverSideSession;
	options.loginUri ??= defaultOptions.loginUri;
	options.scopes ??= defaultOptions.scopes;
	options.responseType ??= defaultOptions.responseType;
	options.responseMode ??= defaultOptions.responseMode;
	options.storageTokenName ??= defaultOptions.storageTokenName;
	options.getMetadata ??= async () => {
		if (state.metadata) {
			return Promise.resolve(state.metadata);
		}

		state.metadata = await fetchMetadata({ issuer: options.issuer, httpClient: options.httpClient! });

		return state.metadata;
	};

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
 * @throws {Error} If the token is invalid or has the wrong format.
 */
export function decodeJwt<T = Record<string, unknown>>(token: string): T {
	const [, payload] = token.split('.');

	if (!payload) {
		throw new Error('Invalid JWT: missing payload segment');
	}

	return JSON.parse(new TextDecoder().decode(decodeBase64URL(payload))) as T;
}

/**
 * Verifies a JWT token's signature against a JWKS endpoint.
 * Only RS256 is supported.
 *
 * @param {string} token - The JWT token to verify.
 * @param {string} jwksUri - The URL of the JWKS endpoint.
 * @template T - The expected structure of the JWT payload.
 * @returns {Promise<T>} The verified payload.
 * @throws {Error} If the token is invalid, the key is not found, or verification fails.
 */
export async function verifyJwt<T = Record<string, unknown>>(token: string, jwksUri: string): Promise<T> {
	const parts = token.split('.');

	if (parts.length !== 3) {
		throw new Error('Invalid JWT: must have 3 parts');
	}

	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	const header = JSON.parse(new TextDecoder().decode(decodeBase64URL(encodedHeader))) as { kid?: string; alg?: string };

	if (header.alg !== 'RS256') {
		throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
	}

	const jwksResponse = await fetch(jwksUri);

	if (!jwksResponse.ok) {
		throw new Error(`Failed to fetch JWKS: HTTP ${jwksResponse.status}`);
	}

	const jwks = (await jwksResponse.json()) as { keys: SigningKey[] };
	const signingKey = header.kid ? jwks.keys.find((k) => k.kid === header.kid) : jwks.keys.find((k) => k.alg === 'RS256');

	if (!signingKey) {
		throw new Error(`No matching key found in JWKS${header.kid ? ` for kid: ${header.kid}` : ''}`);
	}

	const cryptoKey = await globalThis.crypto.subtle.importKey(
		'jwk',
		{ kty: signingKey.kty, n: signingKey.n, e: signingKey.e, alg: signingKey.alg, use: signingKey.use },
		{ name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
		false,
		['verify'],
	);

	const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
	const signature = decodeBase64URL(encodedSignature);
	const valid = await globalThis.crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, cryptoKey, signature, data);

	if (!valid) {
		throw new Error('JWT signature verification failed');
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function generateJwt(header: object, payload: object, privateKey?: CryptoKey): Promise<string> {
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
 * Fetches the OIDC metadata from the authorization server.
 *
 * @param {Object} options - The SDK options containing the issuer URL and HTTP client.
 * @param {string} options.issuer - The issuer URL of the authorization server.
 * @param {SDKHttpClient} options.httpClient - The HTTP client to use for fetching the metadata.
 * @returns {Promise<MetadataOptions>} A promise that resolves to the fetched metadata.
 * @throws {Error} If the metadata fetch fails or returns a non-OK response.
 */
export async function fetchMetadata({ issuer, httpClient }: { issuer: string; httpClient: SDKHttpClient }): Promise<MetadataOptions> {
	const response = await httpClient.request<MetadataOptions>(new URL('/.well-known/openid-configuration', issuer));

	if (!response.ok) {
		throw new Error(`Failed to fetch OIDC metadata: HTTP ${response.status}`);
	}

	return await response.json();
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
	url?: string | URL;
	includeOAuthParams?: boolean;
	persistState?: boolean;
	params: URLHandlerParams;
	options: SDKOptions;
}): Promise<URL> {
	const stateData = await createState();
	stateData.metadata = {};

	if (!url) {
		url = new URL((await options.getMetadata()).authorization_endpoint);
	}
	if (typeof url === 'string') {
		url = new URL(url, globalThis.location.origin);
	}

	if (includeOAuthParams) {
		url.searchParams.append('client_id', options.clientId);
		url.searchParams.append('redirect_uri', options.redirectUri);
		url.searchParams.append('response_type', options.responseType ?? 'code');
		url.searchParams.append('response_mode', options.responseMode ?? 'query');
		url.searchParams.append('scope', options.scopes?.join(' ') ?? 'openid');
		url.searchParams.append('code_challenge_method', 'S256');
		url.searchParams.append('state', stateData.id);
		url.searchParams.append('code_challenge', stateData.codeChallenge);

		if (options.scopes?.includes('openid')) {
			url.searchParams.append('nonce', stateData.nonce);
		}
	}

	if (params.prompt) {
		url.searchParams.append('prompt', params.prompt);
		stateData.metadata.prompt = params.prompt;
	}
	if (params.display) {
		url.searchParams.append('display', params.display);
		stateData.metadata.display = params.display;
	}
	if (params.acrValues?.length) {
		url.searchParams.append('acr_values', params.acrValues.join(' '));
		stateData.metadata.acrValues = params.acrValues;
	}
	if (params.loginHint?.length) {
		url.searchParams.append('login_hint', params.loginHint);
		stateData.metadata.loginHint = params.loginHint;
	}
	if (params.uiLocales?.length) {
		url.searchParams.append('ui_locales', params.uiLocales.join(' '));
		stateData.metadata.uiLocales = params.uiLocales;
	}
	if (params.audiences?.length) {
		url.searchParams.append('audience', params.audiences.join(' '));
		stateData.metadata.audiences = params.audiences;
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

	endSessionUrl.searchParams.append('id_token_hint', idToken);

	if (postLogoutRedirectUri) {
		endSessionUrl.searchParams.append('post_logout_redirect_uri', postLogoutRedirectUri);
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
 * @throws {Error} If the authorization code exchange fails or if the state or ID token claims are invalid
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
		throw new Error(`${session.error}: ${session.error_description}`);
	}
	if (!session.code) {
		throw new Error('Invalid or missing authorization code');
	}

	const serializedState = await options.stateStorage.get(`sty.${session.state}`);

	if (!serializedState) {
		throw new Error('Invalid or missing state');
	}

	let state;

	try {
		state = parseState(serializedState);
	} catch {
		throw new Error('Invalid or missing state');
	}

	await options.stateStorage.delete(`sty.${session.state}`);

	const tokenUrl = url ?? (await options.getMetadata()).token_endpoint;
	const response = await options.httpClient.sendTokenRequest<Record<string, string>>(tokenUrl, {
		grant_type: 'authorization_code',
		client_id: options.clientId,
		redirect_uri: options.redirectUri,
		code_verifier: state.codeVerifier,
		code: session.code,
	});

	if (!response.ok) {
		const err = await response.json();
		throw new Error(`${err.error}: ${err.error_description}`);
	}

	const updatedSession: SessionData = { ...params, ...createSession(await response.json()) };

	if (updatedSession.error) {
		throw new Error(`${updatedSession.error}: ${updatedSession.error_description}`);
	}

	if (updatedSession.id_token) {
		updatedSession.claims = decodeJwt<IdTokenClaims>(updatedSession.id_token);

		const now = timestamp();

		if (updatedSession.claims?.nonce !== state.nonce) {
			throw new Error('Invalid nonce');
		}
		if (updatedSession.claims?.iss !== `${options.issuer}/`) {
			throw new Error('Invalid iss');
		}
		if (Array.isArray(updatedSession.claims?.aud) ? !updatedSession.claims.aud.includes(options.clientId) : updatedSession.claims?.aud !== options.clientId) {
			throw new Error('Invalid aud');
		}
		if (!updatedSession.claims?.exp || updatedSession.claims.exp <= now) {
			throw new Error('Token has expired');
		}
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
 * @throws {Error} If the refresh token is missing or if the token refresh request fails
 */
export async function refreshToken({
	url,
	refreshToken,
	options,
	grantType = 'refresh_token',
	clientId,
	audience,
	scope,
}: {
	url?: string | URL;
	refreshToken: string;
	options: SDKOptions;
	grantType?: string;
	clientId?: string;
	audience?: string;
	scope?: string;
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

	const refreshUrl = url ?? (await options.getMetadata()).token_endpoint;
	const response = await options.httpClient.sendTokenRequest<Record<string, string>>(refreshUrl, params);

	if (!response.ok) {
		const err = await response.json();
		throw new Error(`${err.error}: ${err.error_description}`);
	}

	const updatedSession: SessionData = createSession(await response.json());

	if (updatedSession.error) {
		throw new Error(`${updatedSession.error}: ${updatedSession.error_description}`);
	}

	if (updatedSession.id_token) {
		updatedSession.claims = decodeJwt<IdTokenClaims>(updatedSession.id_token);

		if (updatedSession.claims?.iss !== `${options.issuer}/`) {
			throw new Error('Invalid iss');
		}

		if (Array.isArray(updatedSession.claims?.aud) ? updatedSession.claims?.aud[0] !== options.clientId : updatedSession.claims?.aud !== options.clientId) {
			throw new Error('Invalid aud');
		}
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
 * @throws {Error} If the token revocation request fails
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
	const revokeUrl = url ?? (await options.getMetadata()).revocation_endpoint;
	const response = await options.httpClient.sendTokenRequest<Record<string, string>>(revokeUrl, {
		client_id: clientId ?? options.clientId,
		token_type_hint: tokenTypeHint,
		token,
	});

	if (response && !response.ok) {
		const err = await response.json();
		throw new Error(`${err.error}: ${err.error_description}`);
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
 * @throws {Error} If the entry request fails or required fields are missing from the response.
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
	params.append('sdk', sdkMode);
	params.append('client_id', clientId ?? options.clientId);
	params.append('redirect_uri', redirectUri ?? options.redirectUri);

	const requestUrl = new URL(url);
	requestUrl.search = params.toString();

	const response = await options.httpClient.request<string | Record<string, string>>(requestUrl);

	if (!response.ok) {
		if (response.status === 400) {
			const data = await response.json();
			let message = 'Entry request failed with status 400';

			if (data && typeof data === 'object') {
				if (data.error) {
					message = `${data.error}: ${data.error_description}`;
				} else if (data.errorKey) {
					message = data.errorKey;
				}
			}

			throw new Error(message);
		}

		throw new Error(`Entry request failed with status ${response.status}`);
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

	if (!shortAppId) {
		throw new Error('"short_app_id" is missing from the response');
	}
	if (!sessionId) {
		throw new Error('"session_id" is missing from the response');
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
 * @throws {Error} Throws an error if callback handler is not defined or redirect URI is invalid.
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
		throw new Error(`Failed to finalize login session: HTTP ${response.status}`);
	}

	const redirectUri = new URL(await response.text());

	if (!redirectUri.toString().startsWith(options.redirectUri)) {
		throw new Error('Invalid redirect URI');
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
 * @returns {Promise<LoginFlowState>} A promise that resolves to the current login flow state.
 * @throws {Error} If the server returns a non-recoverable HTTP error.
 * @throws {FallbackError} If the server indicates the flow should fall back to the hosted UI.
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
}): Promise<LoginFlowState> {
	const response = await options.httpClient.request<LoginFlowState>(new URL(`/flow/api/v1/${formId ? `form/${formId}` : 'init'}`, options.issuer), {
		method: 'POST',
		credentials: 'include',
		body: JSON.stringify(body),
		headers: {
			Authorization: `Bearer ${sessionId}`,
			'Content-Type': 'application/json',
			'Accept-language': language,
		},
	});
	const data = await response.json();

	if (!response.ok) {
		if (response.status >= 400 && response.status < 500) {
			if (response.status !== 403 && data?.hostedUrl && !data.messages) {
				throw new FallbackError(new URL(data.hostedUrl), `Triggering fallback due to: Received HTTP ${response.status} without messages`);
			}

			if (response.status !== 400) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		}
	}

	if (data.hostedUrl && !data.finalizeUrl && !data.forms && !data.messages) {
		throw new FallbackError(new URL(data.hostedUrl), 'Triggering fallback due to: No forms or messages in response');
	}

	return data;
}
