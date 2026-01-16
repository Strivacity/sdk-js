/**
 * Makes properties of `T` required based on the keys provided in `K`.
 *
 * @template T - The type from which properties will be made required.
 * @template K - The keys of `T` that should be required.
 * @example
 * type MyType = { a?: string; b?: number; c?: boolean };
 * type RequiredAB = Mandatory<MyType, 'a' | 'b'>; // { a: string; b: number; c?: boolean }
 */
export type Mandatory<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

/**
 * A type representing a partial record of key-value pairs where keys are of type `K` and values are of type `T`.
 *
 * @template K - The type of the keys in the record.
 * @template T - The type of the values in the record.
 * @example
 * type StringMap = PartialRecord<string, string>; // { [key: string]: string | undefined }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PartialRecord<K extends keyof any, T> = {
	[P in K]?: T;
};

// region SDK

/**
 * List of supported response types.
 */
export const ResponseTypeList = ['code', 'id_token'] as const;
/**
 * Type representing valid response types.
 */
export type ResponseType = (typeof ResponseTypeList)[number];

/**
 * List of supported response modes.
 */
export const ResponseModeList = ['query', 'fragment'] as const;
/**
 * Type representing valid response modes.
 */
export type ResponseMode = (typeof ResponseModeList)[number];

/**
 * List of supported token endpoint authentication methods.
 */
export const TokenEndpointAuthMethodList = ['none'] as const;
/**
 * Type representing valid token endpoint authentication methods.
 */
export type TokenEndpointAuthMethod = (typeof TokenEndpointAuthMethodList)[number];

/**
 * List of supported grant types.
 */
export const GrantTypeList = ['authorization_code', 'refresh_token'] as const;
/**
 * Type representing valid grant types.
 */
export type GrantType = (typeof GrantTypeList)[number];

/**
 * List of supported algorithm types.
 */
export const AlgorithmTypeList = ['RS256'] as const;
/**
 * Type representing valid algorithm types.
 */
export type AlgorithmType = (typeof AlgorithmTypeList)[number];

/**
 * List of supported subject types.
 */
export const SubjectTypeList = ['public'] as const;
/**
 * Type representing valid subject types.
 */
export type SubjectType = (typeof SubjectTypeList)[number];

/**
 * List of supported prompt types.
 */
export const PromptTypeList = ['none', 'login', 'create'] as const;
/**
 * Type representing valid prompt types.
 */
export type PromptType = (typeof PromptTypeList)[number];

/**
 * List of supported fallback modes.
 */
export const FallbackModeTypeList = ['redirect', 'popup'] as const;
/**
 * Type representing valid fallback modes.
 */
export type FallbackMode = (typeof FallbackModeTypeList)[number];

/**
 * Represents a signing key used in cryptographic operations, such as signing JSON Web Tokens (JWTs).
 *
 * This type defines the key's properties, including its usage, type, identifier, algorithm, and key material.
 */
export type SigningKey = {
	/**
	 * The intended use of the key. Common values include "sig" for signature and "enc" for encryption.
	 *
	 * @type {string}
	 * @example 'sig'
	 */
	use: string;

	/**
	 * The key type. For example, "RSA" for RSA keys or "EC" for Elliptic Curve keys.
	 *
	 * @type {string}
	 * @example 'RSA'
	 */
	kty: string;

	/**
	 * A unique identifier for the key. This is used to distinguish the key from others.
	 *
	 * @type {string}
	 * @example 'key-id-1234'
	 */
	kid: string;

	/**
	 * The algorithm used with the key. For example, "RS256" for RSA SHA-256.
	 *
	 * @type {AlgorithmType}
	 * @example 'RS256'
	 */
	alg: AlgorithmType;

	/**
	 * The modulus of the RSA key, encoded in base64url format. For RSA keys, this is a required property.
	 *
	 * @type {string}
	 * @example 'base64url-encoded-modulus'
	 */
	n: string;

	/**
	 * The exponent of the RSA key, encoded in base64url format. For RSA keys, this is a required property.
	 *
	 * @type {string}
	 * @example 'base64url-encoded-exponent'
	 */
	e: string;
};

/**
 * Represents the metadata options provided by an authorization server.
 *
 * This metadata includes information about the server's endpoints, supported features, and supported claims.
 */
export type MetadataOptions = {
	/**
	 * The issuer of the tokens. This is the authorization server or entity that issues the tokens.
	 *
	 * @type {string}
	 * @example 'https://example.com'
	 */
	issuer: string;

	/**
	 * The URL of the authorization endpoint where authentication requests are sent.
	 *
	 * @type {string}
	 * @example 'https://example.com/oauth/authorize'
	 */
	authorization_endpoint: string;

	/**
	 * The URL of the token endpoint where tokens are exchanged.
	 *
	 * @type {string}
	 * @example 'https://example.com/oauth/token'
	 */
	token_endpoint: string;

	/**
	 * The URL of the JSON Web Key Set (JWKS) endpoint where public keys are available.
	 *
	 * @type {string}
	 * @example 'https://example.com/oauth/jwks'
	 */
	jwks_uri: string;

	/**
	 * The types of subjects that are supported by the authorization server.
	 *
	 * @type {Array<SubjectType>}
	 * @example ['public']
	 */
	subject_types_supported: Array<SubjectType>;

	/**
	 * The types of responses supported by the authorization server.
	 *
	 * @type {Array<string>}
	 * @example ['code', 'id_token']
	 */
	response_types_supported: Array<string>;

	/**
	 * The claims supported by the authorization server.
	 *
	 * @type {Array<string>}
	 * @example ['sub', 'name', 'email']
	 */
	claims_supported: Array<string>;

	/**
	 * The grant types supported by the authorization server.
	 *
	 * @type {Array<GrantType>}
	 * @example ['authorization_code', 'refresh_token']
	 */
	grant_types_supported: Array<GrantType>;

	/**
	 * The response modes supported by the authorization server.
	 *
	 * @type {Array<ResponseMode>}
	 * @example ['query', 'fragment']
	 */
	response_modes_supported: Array<ResponseMode>;

	/**
	 * The URL of the user info endpoint where user information can be retrieved.
	 *
	 * @type {string}
	 * @example 'https://example.com/userinfo'
	 */
	userinfo_endpoint: string;

	/**
	 * The scopes supported by the authorization server.
	 *
	 * @type {Array<string>}
	 * @example ['openid', 'profile', 'email']
	 */
	scopes_supported: Array<string>;

	/**
	 * The authentication methods supported for token endpoint authentication.
	 *
	 * @type {Array<TokenEndpointAuthMethod>}
	 * @example ['none']
	 */
	token_endpoint_auth_methods_supported: Array<TokenEndpointAuthMethod>;

	/**
	 * The algorithms supported for signing tokens used in the user info endpoint.
	 *
	 * @type {Array<AlgorithmType>}
	 * @example ['RS256']
	 */
	userinfo_signing_alg_values_supported: Array<AlgorithmType>;

	/**
	 * The algorithms supported for signing ID tokens.
	 *
	 * @type {Array<AlgorithmType>}
	 * @example ['RS256']
	 */
	id_token_signing_alg_values_supported: Array<AlgorithmType>;

	/**
	 * The algorithms used to sign ID tokens in response.
	 *
	 * @type {Array<AlgorithmType>}
	 * @example ['RS256']
	 */
	id_token_signed_response_alg: Array<AlgorithmType>;

	/**
	 * The algorithms used to sign responses from the user info endpoint.
	 *
	 * @type {Array<AlgorithmType>}
	 * @example ['RS256']
	 */
	userinfo_signed_response_alg: Array<AlgorithmType>;

	/**
	 * Indicates whether the request parameter is supported in requests.
	 *
	 * @type {boolean}
	 * @example true
	 */
	request_parameter_supported: boolean;

	/**
	 * Indicates whether the request URI parameter is supported in requests.
	 *
	 * @type {boolean}
	 * @example true
	 */
	request_uri_parameter_supported: boolean;

	/**
	 * Indicates whether request URI registration is required.
	 *
	 * @type {boolean}
	 * @example true
	 */
	require_request_uri_registration: boolean;

	/**
	 * Indicates whether the claims parameter is supported.
	 *
	 * @type {boolean}
	 * @example true
	 */
	claims_parameter_supported: boolean;

	/**
	 * The URL of the revocation endpoint for revoking tokens.
	 *
	 * @type {string}
	 * @example 'https://example.com/oauth/revoke'
	 */
	revocation_endpoint: string;

	/**
	 * Indicates whether backchannel logout is supported.
	 *
	 * @type {boolean}
	 * @example true
	 */
	backchannel_logout_supported: boolean;

	/**
	 * Indicates whether backchannel logout session support is provided.
	 *
	 * @type {boolean}
	 * @example true
	 */
	backchannel_logout_session_supported: boolean;

	/**
	 * Indicates whether frontchannel logout is supported.
	 *
	 * @type {boolean}
	 * @example true
	 */
	frontchannel_logout_supported: boolean;

	/**
	 * Indicates whether frontchannel logout session support is provided.
	 *
	 * @type {boolean}
	 * @example true
	 */
	frontchannel_logout_session_supported: boolean;

	/**
	 * The URL of the endpoint where end-session requests can be sent.
	 *
	 * @type {string}
	 * @example 'https://example.com/logout'
	 */
	end_session_endpoint: string;

	/**
	 * The algorithms supported for signing request objects.
	 *
	 * @type {Array<AlgorithmType>}
	 * @example ['RS256']
	 */
	request_object_signing_alg_values_supported: Array<AlgorithmType>;

	/**
	 * The code challenge methods supported by the authorization server.
	 *
	 * @type {Array<'S256'>}
	 * @example ['S256']
	 */
	code_challenge_methods_supported: Array<'S256'>;
};

/**
 * Represents the standard claims in a JSON Web Token (JWT).
 *
 * These claims are part of the payload in a JWT and convey information about the token, such as its issuer, subject, and expiration.
 */
export type JwtClaims = {
	/**
	 * The issuer of the token. This typically represents the authorization server or entity that issued the JWT.
	 *
	 * @type {string}
	 * @example 'https://example.com'
	 */
	iss?: string;

	/**
	 * The subject of the token. This is the identifier for the entity the token represents, such as a user ID.
	 *
	 * @type {string}
	 * @example 'user123'
	 */
	sub?: string;

	/**
	 * The audience for which the token is intended. This can be a single identifier or an array of identifiers.
	 *
	 * @type {string | Array<string>}
	 * @example 'your-client-id' | ['client1', 'client2']
	 */
	aud?: string | Array<string>;

	/**
	 * The expiration time of the token, expressed as a Unix timestamp (number of seconds since January 1, 1970).
	 *
	 * @type {number}
	 * @example 1633024800
	 */
	exp?: number;

	/**
	 * The not-before time of the token, expressed as a Unix timestamp. The token must not be accepted before this time.
	 *
	 * @type {number}
	 * @example 1633021200
	 */
	nbf?: number;

	/**
	 * The issued-at time of the token, expressed as a Unix timestamp (number of seconds since January 1, 1970).
	 *
	 * @type {number}
	 * @example 1633022400
	 */
	iat?: number;

	/**
	 * A unique identifier for the token. This can be used to prevent token replay attacks.
	 *
	 * @type {string}
	 * @example 'unique-jwt-id-1234'
	 */
	jti?: string;
};

/**
 * Represents the claims included in an ID token, extending standard JWT claims with additional properties specific to identity tokens.
 *
 * ID tokens are used to authenticate and provide identity information about the user.
 */
export type IdTokenClaims = Mandatory<JwtClaims, 'iss' | 'sub' | 'aud' | 'exp' | 'iat'> & {
	/**
	 * The authentication time, indicating when the user was authenticated.
	 *
	 * @type {number}
	 * @example 1633022400
	 */
	auth_time?: number;

	/**
	 * A nonce value used to associate a client session with an ID token, preventing replay attacks.
	 *
	 * @type {string}
	 * @example 'nonce-value-1234'
	 */
	nonce?: string;

	/**
	 * The Authentication Context Class Reference, indicating the authentication methods used.
	 *
	 * @type {string}
	 * @example '2'
	 */
	acr?: string;

	/**
	 * The Authentication Methods References, providing information about the authentication methods used.
	 *
	 * @type {unknown}
	 */
	amr?: unknown;

	/**
	 * Authorized party, the client that the ID token is intended for.
	 *
	 * @type {string}
	 * @example 'client-id'
	 */
	azp?: string;

	/**
	 * Session ID for the user, which can be used to manage user sessions.
	 *
	 * @type {string}
	 * @example 'session-id-1234'
	 */
	sid?: string;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
};

/**
 * Options for configuring the SDK.
 */
export type SDKOptions = {
	/**
	 * Specifies the mode of the SDK operation, either 'popup' or 'redirect'.
	 *
	 * @type {'popup' | 'redirect'}
	 * @default 'redirect'
	 */
	mode?: 'popup' | 'redirect' | 'native';

	/**
	 * The issuer of the tokens, typically the URL of the authorization server.
	 *
	 * @type {string}
	 * @example 'https://example.com'
	 */
	issuer: string;

	/**
	 * The client ID issued by the authorization server, used to identify the application.
	 *
	 * @type {string}
	 * @example 'your-client-id'
	 */
	clientId: string;

	/**
	 * The URI to which the user will be redirected after authentication or authorization.
	 *
	 * @type {string}
	 * @example 'https://example.com/callback'
	 */
	redirectUri: string;

	/**
	 * A list of scopes requested by the application, defining the access levels for the tokens.
	 *
	 * @type {Array<string>}
	 * @default ['openid']
	 * @example ['openid', 'profile']
	 */
	scopes?: Array<string>;

	/**
	 * The type of response expected from the authorization server.
	 *
	 * @type {ResponseType}
	 * @default 'code'
	 */
	responseType?: ResponseType;

	/**
	 * The mode in which the response is returned from the authorization server.
	 *
	 * @type {ResponseMode}
	 * @default 'query'
	 */
	responseMode?: ResponseMode;

	/**
	 * The name of the token in storage used to persist authentication information.
	 *
	 * @type {string}
	 * @default 'sty.session'
	 * @example 'accessToken'
	 */
	storageTokenName?: string;

	/**
	 * The storage mechanism used to save and retrieve authentication information.
	 *
	 * @type {SDKStorageType}
	 * @default LocalStorage
	 */
	storage?: SDKStorageType;

	/**
	 * The HTTP client used for making requests to the authorization server.
	 *
	 * @type {SDKHttpClient}
	 * @default HttpClient
	 */
	httpClient?: SDKHttpClientType;

	/**
	 * Handles the URL redirection to the specified target.
	 * You can use this method to implement custom URL handling logic, such as opening a new window or navigating to a different page.
	 *
	 * @param {string} url - The URL to handle.
	 * @param {Record<string, unknown>} params - Optional parameters for redirection.
	 * @returns - A promise that resolves when the redirection is handled.
	 */
	urlHandler?: (url: string, params?: Record<string, unknown>) => Promise<unknown>;

	/**
	 * Handles the callback from the authorization server after a successful authentication or authorization.
	 * You can use this method to implement custom logic for processing the response from the authorization server.
	 *
	 * @param url - The URL containing the response from the authorization server.
	 * @param responseMode - The mode in which the response is returned (e.g., 'query', 'fragment').
	 * @returns - A promise that resolves when the callback is handled.
	 */
	callbackHandler?: (url: string, responseMode?: ResponseMode) => Promise<unknown>;
};

/**
 * Abstract class for SDK storage mechanisms.
 */
export abstract class SDKStorage {
	/**
	 * Retrieves an item from the storage by key.
	 *
	 * @param {string} key - The key of the item to retrieve.
	 * @returns {string | null} The value associated with the key, or `null` if not found.
	 */
	abstract get(key: string): Promise<string | null>;

	/**
	 * Deletes an item from the storage by key.
	 *
	 * @param {string} key - The key of the item to delete.
	 */
	abstract delete(key: string): Promise<void>;

	/**
	 * Sets an item in the storage with the specified key and value.
	 *
	 * @param {string} key - The key to associate with the value.
	 * @param {string} value - The value to store.
	 */
	abstract set(key: string, value: string): Promise<void>;
}

/**
 * Abstract class for HTTP client used in the SDK.
 */
export abstract class SDKHttpClient {
	/**
	 * Makes an HTTP request to the specified URL with optional options.
	 * @param {string} url - The URL to which the request is sent.
	 * @param {RequestInit} options - Optional request options, such as method, headers, body, etc.
	 */
	abstract request<T>(url: string, options?: RequestInit): Promise<HttpClientResponse<T>>;
}

/**
 * Type representing a constructor function for SDKStorage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SDKStorageType = new (...args: Array<any>) => SDKStorage;

/**
 * Type representing a constructor function for SDKHttpClient.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SDKHttpClientType = new (...args: Array<any>) => SDKHttpClient;

/**
 * Http client response type.
 */
export type HttpClientResponse<T> = {
	readonly headers: Headers;
	readonly ok: boolean;
	readonly status: number;
	readonly statusText: string;
	readonly url: string;
	json(): Promise<T>;
	text(): Promise<string>;
};

/**
 * A collection of functions used to handle various events that occur within the SDK.
 */
export type EventFunctions = {
	/**
	 * Handler called when an access token has expired.
	 *
	 * @param {Object} params - The parameters for the event.
	 * @param {string} params.accessToken - The expired access token.
	 * @param {string | null} [params.refreshToken] - The refresh token associated with the access token, if available.
	 * @returns {Promise<void> | void} A promise that resolves when the handler completes, or void if no asynchronous operation is needed.
	 */
	accessTokenExpired: (params: { accessToken: string; refreshToken?: string | null }) => Promise<void> | void;

	/**
	 * Handler called when the SDK is initialized.
	 *
	 * @returns {Promise<void> | void} A promise that resolves when the initialization is complete, or void if no asynchronous operation is needed.
	 */
	init: () => Promise<void> | void;

	/**
	 * Handler called when a user has successfully logged in.
	 *
	 * @param {Object} params - The parameters for the event.
	 * @param {string} params.accessToken - The access token obtained after login.
	 * @param {string | null} [params.refreshToken] - The refresh token obtained after login, if available.
	 * @param {IdTokenClaims} params.claims - The claims extracted from the ID token.
	 * @returns {Promise<void> | void} A promise that resolves when the handler completes, or void if no asynchronous operation is needed.
	 */
	loggedIn: (params: { accessToken: string; refreshToken?: string | null; claims: IdTokenClaims }) => Promise<void> | void;

	/**
	 * Handler called when login has been initiated.
	 *
	 * @returns {Promise<void> | void} A promise that resolves when the login initiation process is complete, or void if no asynchronous operation is needed.
	 */
	loginInitiated: () => Promise<void> | void;

	/**
	 * Handler called when a logout request has been initiated.
	 *
	 * @param {Object} params - The parameters for the event.
	 * @param {string} params.idToken - The ID token associated with the logout request.
	 * @param {IdTokenClaims} params.claims - The claims associated with the ID token.
	 * @returns {Promise<void> | void} A promise that resolves when the logout initiation process is complete, or void if no asynchronous operation is needed.
	 */
	logoutInitiated: (params: { idToken: string; claims: IdTokenClaims }) => Promise<void> | void;

	/**
	 * Handler called when a user session has been successfully loaded.
	 *
	 * @param {Object} params - The parameters for the event.
	 * @param {string} params.accessToken - The access token associated with the loaded session.
	 * @param {string | null} [params.refreshToken] - The refresh token associated with the session, if available.
	 * @param {IdTokenClaims} params.claims - The claims associated with the ID token in the session.
	 * @returns {Promise<void> | void} A promise that resolves when the session loading is complete, or void if no asynchronous operation is needed.
	 */
	sessionLoaded: (params: { accessToken: string; refreshToken?: string | null; claims: IdTokenClaims }) => Promise<void> | void;

	/**
	 * Handler called when an access token has been successfully refreshed.
	 *
	 * @param {Object} params - The parameters for the event.
	 * @param {string} params.accessToken - The new access token obtained after the refresh.
	 * @param {string} params.refreshToken - The refresh token used to obtain the new access token.
	 * @param {IdTokenClaims} params.claims - The claims extracted from the new ID token.
	 * @returns {Promise<void> | void} A promise that resolves when the token refresh is complete, or void if no asynchronous operation is needed.
	 */
	tokenRefreshed: (params: { accessToken: string; refreshToken: string; claims: IdTokenClaims }) => Promise<void> | void;

	/**
	 * Handler called when a token refresh operation fails.
	 *
	 * @param {Object} params - The parameters for the event.
	 * @param {string} params.refreshToken - The refresh token that was used in the failed refresh operation.
	 * @returns {Promise<void> | void} A promise that resolves when the handler completes, or void if no asynchronous operation is needed.
	 */
	tokenRefreshFailed: (params: { refreshToken: string }) => Promise<void> | void;

	/**
	 * Handler called when a token has been successfully revoked.
	 *
	 * @param {Object} params - The parameters for the event.
	 * @param {string} params.token - The token that was revoked.
	 * @param {'refresh_token' | 'access_token'} params.tokenTypeHint - The type of token that was revoked.
	 * @returns {Promise<void> | void} A promise that resolves when the handler completes, or void if no asynchronous operation is needed.
	 */
	tokenRevoked: (params: { token: string; tokenTypeHint: 'refresh_token' | 'access_token' }) => Promise<void> | void;

	/**
	 * Handler called when a token revocation operation fails.
	 *
	 * @param {Object} params - The parameters for the event.
	 * @param {string} params.token - The token that was attempted to be revoked.
	 * @param {'refresh_token' | 'access_token'} params.tokenTypeHint - The type of token that was attempted to be revoked.
	 * @returns {Promise<void> | void} A promise that resolves when the handler completes, or void if no asynchronous operation is needed.
	 */
	tokenRevokeFailed: (params: { token: string; tokenTypeHint: 'refresh_token' | 'access_token' }) => Promise<void> | void;
};

// endregion

// region Flows

/**
 * Extra parameters that can be used in requests.
 */
/**
 * Additional parameters that can be included in authentication or authorization requests.
 */
export type ExtraRequestArgs = {
	/**
	 * Specifies the type of prompt to display to the user during authentication or authorization.
	 *
	 * @type {PromptType}
	 * @example 'none' | 'login' | 'create'
	 */
	prompt?: PromptType;

	/**
	 * Provides a hint to the authorization server about the user's email or username.
	 *
	 * @type {string}
	 * @example 'user@example.com'
	 */
	loginHint?: string;

	/**
	 * A list of values used to request specific authentication contexts or levels of assurance.
	 *
	 * This parameter allows requesting specific authentication contexts (e.g., multi-factor authentication)
	 * or other criteria that the authorization server should consider when authenticating the user.
	 *
	 * @type {Array<string>}
	 * @example ['urn:mace:incommon:iap:bronze', 'urn:mace:incommon:iap:silver']
	 */
	acrValues?: Array<string>;

	/**
	 * A list of locale codes to request specific language and regional preferences for the user interface.
	 *
	 * This parameter allows requesting the user interface to be presented in specific languages or regional formats.
	 *
	 * @type {Array<string>}
	 * @example ['en-US', 'fr-CA']
	 */
	uiLocales?: Array<string>;

	/**
	 * A list of audience values to specify the intended recipients of the token.
	 *
	 * This parameter allows requesting that the issued token is intended for specific audiences.
	 *
	 * @type {Array<string>}
	 * @example ['https://api.example.com', 'https://service.example.com']
	 */
	audiences?: Array<string>;
};

/**
 * Params for configuring logout behavior.
 */
export type LogoutParams = {
	/**
	 * The URI to redirect to after a successful logout.
	 *
	 * If specified, the user will be redirected to this URI upon completing the logout process.
	 * This is often used to send users back to the main application or a custom post-logout page.
	 *
	 * @type {string}
	 * @example 'https://example.com/home'
	 */
	postLogoutRedirectUri?: string;
};

/**
 * Parameters for redirect authentication flow.
 */
export type RedirectParams = ExtraRequestArgs & {
	/**
	 * The method used to update the browser's location after authentication or authorization.
	 *
	 * Determines whether the new URL should replace the current URL in the history or be added to it.
	 *
	 * @type {'replace' | 'assign'}
	 * @default 'assign'
	 */
	locationMethod?: 'replace' | 'assign';

	/**
	 * The window in which the redirect should occur.
	 *
	 * Specifies whether the redirect should happen in the top-level window or the current window.
	 *
	 * @type {'top' | 'self'}
	 * @default 'self'
	 */
	targetWindow?: 'top' | 'self';
};

/**
 * Features for customizing the popup window.
 */
export type PopupWindowFeatures = {
	/**
	 * The horizontal position of the popup window relative to the left edge of the screen.
	 *
	 * @type {number}
	 * @example 100
	 */
	left?: number;

	/**
	 * The vertical position of the popup window relative to the top edge of the screen.
	 *
	 * @type {number}
	 * @example 100
	 */
	top?: number;

	/**
	 * The width of the popup window.
	 *
	 * @type {number}
	 * @example 600
	 */
	width?: number;

	/**
	 * The height of the popup window.
	 *
	 * @type {number}
	 * @example 400
	 */
	height?: number;

	/**
	 * Whether the popup window should display a menubar.
	 *
	 * Can be a boolean value or a string ('yes' or 'no').
	 *
	 * @type {boolean | string}
	 * @example true
	 */
	menubar?: boolean | string;

	/**
	 * Whether the popup window should display a toolbar.
	 *
	 * Can be a boolean value or a string ('yes' or 'no').
	 *
	 * @type {boolean | string}
	 * @example true
	 */
	toolbar?: boolean | string;

	/**
	 * Whether the popup window should display the address/location bar.
	 *
	 * Can be a boolean value or a string ('yes' or 'no').
	 *
	 * @type {boolean | string}
	 * @example true
	 */
	location?: boolean | string;

	/**
	 * Whether the popup window should display a status bar.
	 *
	 * Can be a boolean value or a string ('yes' or 'no').
	 *
	 * @type {boolean | string}
	 * @example true
	 */
	status?: boolean | string;

	/**
	 * Whether the popup window should be resizable.
	 *
	 * Can be a boolean value or a string ('yes' or 'no').
	 *
	 * @type {boolean | string}
	 * @example false
	 */
	resizable?: boolean | string;

	/**
	 * Whether the popup window should display scrollbars.
	 *
	 * Can be a boolean value or a string ('yes' or 'no').
	 *
	 * @type {boolean | string}
	 * @example false
	 */
	scrollbars?: boolean | string;

	[key: string]: boolean | string | number | undefined;
};

/**
 * Parameters for popup authentication flow.
 */
export type PopupParams = ExtraRequestArgs & {
	/**
	 * Configuration options for the popup window, including size, position, and other features.
	 *
	 * @type {PopupWindowFeatures}
	 */
	popupWindowFeatures?: PopupWindowFeatures;

	/**
	 * The target of the popup window, which specifies where the popup should be opened.
	 *
	 * @type {string}
	 * @example '_blank' | '_self' | '_parent' | '_top'
	 */
	popupWindowTarget?: string;
};

/**
 * Parameters for native authentication flow.
 */
export type NativeParams = RedirectParams & { sdk?: string };

export declare const WidgetTypeList: readonly [
	'layout',
	'submit',
	'close',
	'static',
	'input',
	'checkbox',
	'password',
	'select',
	'multiSelect',
	'passcode',
	'date',
	'phone',
	'loading',
	'passkeyLogin',
	'passkeyEnroll',
	'webauthnLogin',
	'webauthnEnroll',
];
export type WidgetType = (typeof WidgetTypeList)[number];
export declare const SelectOptionTypeList: readonly ['item', 'group'];
export type SelectOptionType = (typeof SelectOptionTypeList)[number];
export type BrandingData = {
	logoUrl: string | null;
	brandName: string | null;
	copyright: string | null;
	privacyPolicyUrl: string | null;
	siteTermsUrl: string | null;
};
export type CheckboxWidget = {
	id: string;
	type: 'checkbox';
	label?: string;
	readonly?: boolean;
	value?: boolean;
	render: {
		type: 'checkboxHidden' | 'checkboxShown';
		labelType: 'text' | 'html';
	};
	validator?: {
		required?: boolean;
	};
};
export type DateWidget = {
	id: string;
	type: 'date';
	label?: string;
	placeholder?: string;
	readonly?: boolean;
	value?: string;
	render: {
		type: 'native' | 'fieldSet';
	};
	validator?: {
		notBefore?: string;
		notAfter?: string;
		required?: boolean;
	};
};
export type InputWidget = {
	id: string;
	type: 'input';
	label?: string;
	value?: string;
	placeholder?: string;
	readonly?: boolean;
	autocomplete?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	inputmode: any;
	render?: {
		autocompleteHint?: string;
	};
	validator?: {
		required?: boolean;
		minLength?: number;
		maxLength?: number;
		regex?: string;
	};
};
export type PasscodeWidget = {
	id: string;
	type: 'passcode';
	label?: string;
	validator?: {
		length?: number;
	};
};
export type PasswordWidget = {
	id: string;
	type: 'password';
	label?: string;
	qualityIndicator?: boolean;
	validator?: {
		minLength?: number;
		maxLength?: number;
		maxNumericCharacterSequences?: number;
		maxRepeatedCharacters?: number;
		mustContain?: Array<'UPPERCASE' | 'LOWERCASE' | 'NUMERIC' | 'SPECIAL'>;
		restrictedCharacters?: string;
	};
};
export type PhoneWidget = {
	id: string;
	type: 'phone';
	label?: string;
	readonly?: boolean;
	value?: string;
	validator?: {
		required?: boolean;
	};
};
export type SelectWidgetOption = {
	type: 'item';
	label?: string;
	value: string;
};
export type SelectWidgetOptionGroup = {
	type: 'group';
	label?: string;
	options: Array<SelectWidgetOption>;
};
export type SelectWidget = {
	id: string;
	type: 'select';
	label?: string;
	readonly?: boolean;
	values?: Array<string>;
	placeholder?: string;
	render: {
		type: 'dropdown' | 'radio';
	};
	options: Array<SelectWidgetOptionGroup | SelectWidgetOption>;
	validator?: {
		required?: boolean;
	};
};
export type MultiSelectWidget = {
	id: string;
	type: 'multiSelect';
	label?: string;
	readonly?: boolean;
	values?: Array<string>;
	placeholder?: string;
	render: {
		type: 'dropdown' | 'checkbox';
	};
	options: Array<SelectWidgetOptionGroup | SelectWidgetOption>;
	validator?: {
		minSelectable?: number;
		maxSelectable?: number;
	};
};
export type StaticWidget = {
	id: string;
	type: 'static';
	value: string;
	render: {
		type: 'html' | 'text';
	};
};
export type SubmitWidget = {
	id: string;
	type: 'submit';
	label?: string;
	render: {
		type: 'button' | 'link';
		textColor?: string;
		bgColor?: string;
		hint?: {
			icon?: string;
			variant?: string;
		};
	};
};
export type CloseWidget = {
	id: string;
	type: 'close';
	label?: string;
	render: {
		type: 'button' | 'link';
		textColor?: string;
		bgColor?: string;
		hint?: {
			icon?: string;
			variant?: string;
		};
	};
};
export type FormWidget = {
	id: string;
	type: 'form';
	widgets: Array<
		CheckboxWidget | DateWidget | InputWidget | PasscodeWidget | PasswordWidget | PhoneWidget | SelectWidget | MultiSelectWidget | StaticWidget | SubmitWidget
	>;
};
export type Widget = {
	type: 'widget';
	formId: string;
	widgetId: string;
};
export type LayoutWidget = {
	type: 'vertical' | 'horizontal';
	items: Array<Widget | LayoutWidget>;
};
export type PasskeyLoginWidget = {
	id: string;
	label?: string;
	render: {
		type: 'button';
		hint?: {
			variant?: string;
		};
		notification?: {
			cancelled?: string;
		};
	};
	assertionOptions: PublicKeyCredentialRequestOptions;
};
export type PasskeyEnrollWidget = {
	id: string;
	label?: string;
	render: {
		type: 'button';
		hint?: {
			variant?: string;
		};
		notification?: {
			cancelled?: string;
		};
	};
	enrollOptions: PublicKeyCredentialCreationOptions;
};
export type WebauthnLoginWidget = {
	id: string;
	label?: string;
	authenticatorType: 'deviceBiometrics' | 'securityKey';
	render: {
		type: 'button';
		hint?: {
			variant?: string;
		};
		notification?: {
			cancelled?: string;
		};
	};
	assertionOptions: PublicKeyCredentialRequestOptions;
};
export type WebauthnEnrollWidget = {
	id: string;
	label?: string;
	authenticatorType: 'deviceBiometrics' | 'securityKey';
	render: {
		type: 'button';
		hint?: {
			variant?: string;
		};
		notification?: {
			cancelled?: string;
		};
	};
	enrollOptions: PublicKeyCredentialCreationOptions;
};
export type LoginFlowMessage = {
	type: string;
	text: string;
};
export type LoginFlowState = {
	hostedUrl?: string;
	finalizeUrl?: string;
	screen?: string;
	branding?: BrandingData;
	forms?: Array<FormWidget>;
	layout?: LayoutWidget;
	messages?: Record<string, Record<string, LoginFlowMessage>> & {
		global?: LoginFlowMessage;
	};
};
export type AssertionPublicKeyCredential = PublicKeyCredential & {
	response: AuthenticatorAssertionResponse;
};
export type AssertionCredentialData = {
	id: string;
	type: string;
	rawId: string;
	response: {
		clientDataJSON: string;
		authenticatorData: string;
		signature: string;
		userHandle: string;
	};
};
export type AttestationPublicKeyCredential = PublicKeyCredential & {
	response: AuthenticatorAttestationResponse;
};
export type AttestationCredentialData = {
	id: string;
	type: string;
	rawId: string;
	authenticatorAttachment: string | null;
	response: {
		clientDataJSON: string;
		attestationObject: string;
		transports: Array<string>;
	};
};

// endregion
