import type { SDKHttpClient, SDKLogging, SDKStorage } from './common';

export const ResponseTypeList = ['code'] as const;
export type ResponseType = (typeof ResponseTypeList)[number];

export const ResponseModeList = ['query', 'fragment'] as const;
export type ResponseMode = (typeof ResponseModeList)[number];

export const TokenEndpointAuthMethodList = ['none'] as const;
export type TokenEndpointAuthMethod = (typeof TokenEndpointAuthMethodList)[number];

export const GrantTypeList = ['authorization_code', 'refresh_token'] as const;
export type GrantType = (typeof GrantTypeList)[number];

export const AlgorithmTypeList = ['RS256'] as const;
export type AlgorithmType = (typeof AlgorithmTypeList)[number];

export const SubjectTypeList = ['public'] as const;
export type SubjectType = (typeof SubjectTypeList)[number];

export const FallbackModeTypeList = ['redirect', 'popup'] as const;
export type FallbackMode = (typeof FallbackModeTypeList)[number];

export type SigningKey = {
	/**
	 * The intended use of the key. Common values include "sig" for signature and "enc" for encryption.
	 *
	 * @type {string}
	 */
	use: string;

	/**
	 * The key type. For example, "RSA" for RSA keys or "EC" for Elliptic Curve keys.
	 *
	 * @type {string}
	 */
	kty: string;

	/**
	 * A unique identifier for the key. This is used to distinguish the key from others.
	 *
	 * @type {string}
	 */
	kid: string;

	/**
	 * The algorithm used with the key. For example, "RS256" for RSA SHA-256.
	 *
	 * @type {AlgorithmType}
	 */
	alg: AlgorithmType;

	/**
	 * The modulus of the RSA key, encoded in base64url format. For RSA keys, this is a required property.
	 *
	 * @type {string}
	 */
	n: string;

	/**
	 * The exponent of the RSA key, encoded in base64url format. For RSA keys, this is a required property.
	 *
	 * @type {string}
	 */
	e: string;
};

export type MetadataOptions = {
	/**
	 * The issuer of the tokens. This is the authorization server or entity that issues the tokens.
	 *
	 * @type {string}
	 */
	issuer: string;

	/**
	 * The URL of the authorization endpoint where authentication requests are sent.
	 *
	 * @type {string}
	 */
	authorization_endpoint: string;

	/**
	 * The URL of the token endpoint where tokens are exchanged.
	 *
	 * @type {string}
	 */
	token_endpoint: string;

	/**
	 * The URL of the JSON Web Key Set (JWKS) endpoint where public keys are available.
	 *
	 * @type {string}
	 */
	jwks_uri: string;

	/**
	 * The types of subjects that are supported by the authorization server.
	 *
	 * @type {Array<SubjectType>}
	 */
	subject_types_supported: Array<SubjectType>;

	/**
	 * The types of responses supported by the authorization server.
	 *
	 * @type {Array<string>}
	 */
	response_types_supported: Array<string>;

	/**
	 * The claims supported by the authorization server.
	 *
	 * @type {Array<string>}
	 */
	claims_supported: Array<string>;

	/**
	 * The grant types supported by the authorization server.
	 *
	 * @type {Array<GrantType>}
	 */
	grant_types_supported: Array<GrantType>;

	/**
	 * The response modes supported by the authorization server.
	 *
	 * @type {Array<ResponseMode>}
	 */
	response_modes_supported: Array<ResponseMode>;

	/**
	 * The URL of the user info endpoint where user information can be retrieved.
	 *
	 * @type {string}
	 */
	userinfo_endpoint: string;

	/**
	 * The scopes supported by the authorization server.
	 *
	 * @type {Array<string>}
	 */
	scopes_supported: Array<string>;

	/**
	 * The authentication methods supported for token endpoint authentication.
	 *
	 * @type {Array<TokenEndpointAuthMethod>}
	 */
	token_endpoint_auth_methods_supported: Array<TokenEndpointAuthMethod>;

	/**
	 * The algorithms supported for signing tokens used in the user info endpoint.
	 *
	 * @type {Array<AlgorithmType>}
	 */
	userinfo_signing_alg_values_supported: Array<AlgorithmType>;

	/**
	 * The algorithms supported for signing ID tokens.
	 *
	 * @type {Array<AlgorithmType>}
	 */
	id_token_signing_alg_values_supported: Array<AlgorithmType>;

	/**
	 * The algorithms used to sign ID tokens in response.
	 *
	 * @type {Array<AlgorithmType>}
	 */
	id_token_signed_response_alg: Array<AlgorithmType>;

	/**
	 * The algorithms used to sign responses from the user info endpoint.
	 *
	 * @type {Array<AlgorithmType>}
	 */
	userinfo_signed_response_alg: Array<AlgorithmType>;

	/**
	 * Indicates whether the request parameter is supported in requests.
	 *
	 * @type {boolean}
	 */
	request_parameter_supported: boolean;

	/**
	 * Indicates whether the request URI parameter is supported in requests.
	 *
	 * @type {boolean}
	 */
	request_uri_parameter_supported: boolean;

	/**
	 * Indicates whether request URI registration is required.
	 *
	 * @type {boolean}
	 */
	require_request_uri_registration: boolean;

	/**
	 * Indicates whether the claims parameter is supported.
	 *
	 * @type {boolean}
	 */
	claims_parameter_supported: boolean;

	/**
	 * The URL of the revocation endpoint for revoking tokens.
	 *
	 * @type {string}
	 */
	revocation_endpoint: string;

	/**
	 * Indicates whether backchannel logout is supported.
	 *
	 * @type {boolean}
	 */
	backchannel_logout_supported: boolean;

	/**
	 * Indicates whether backchannel logout session support is provided.
	 *
	 * @type {boolean}
	 */
	backchannel_logout_session_supported: boolean;

	/**
	 * Indicates whether frontchannel logout is supported.
	 *
	 * @type {boolean}
	 */
	frontchannel_logout_supported: boolean;

	/**
	 * Indicates whether frontchannel logout session support is provided.
	 *
	 * @type {boolean}
	 */
	frontchannel_logout_session_supported: boolean;

	/**
	 * The URL of the endpoint where end-session requests can be sent.
	 *
	 * @type {string}
	 */
	end_session_endpoint: string;

	/**
	 * The algorithms supported for signing request objects.
	 *
	 * @type {Array<AlgorithmType>}
	 */
	request_object_signing_alg_values_supported: Array<AlgorithmType>;

	/**
	 * The code challenge methods supported by the authorization server.
	 *
	 * @type {Array<'S256'>}
	 */
	code_challenge_methods_supported: Array<'S256'>;
};

export type JwtClaims = {
	/**
	 * The issuer of the token. This typically represents the authorization server or entity that issued the JWT.
	 *
	 * @type {string}
	 */
	iss?: string;

	/**
	 * The subject of the token. This is the identifier for the entity the token represents, such as a user ID.
	 *
	 * @type {string}
	 */
	sub?: string;

	/**
	 * The audience for which the token is intended. This can be a single identifier or an array of identifiers.
	 *
	 * @type {string | Array<string>}
	 */
	aud?: string | Array<string>;

	/**
	 * The expiration time of the token, expressed as a Unix timestamp (number of seconds since January 1, 1970).
	 *
	 * @type {number}
	 */
	exp?: number;

	/**
	 * The not-before time of the token, expressed as a Unix timestamp. The token must not be accepted before this time.
	 *
	 * @type {number}
	 */
	nbf?: number;

	/**
	 * The issued-at time of the token, expressed as a Unix timestamp (number of seconds since January 1, 1970).
	 *
	 * @type {number}
	 */
	iat?: number;

	/**
	 * A unique identifier for the token. This can be used to prevent token replay attacks.
	 *
	 * @type {string}
	 */
	jti?: string;
};

export type IdTokenClaims = Required<Pick<JwtClaims, 'iss' | 'sub' | 'aud' | 'exp' | 'iat' | 'jti'>> & {
	/**
	 * The authentication time, indicating when the user was authenticated.
	 *
	 * @type {number}
	 */
	auth_time?: number;

	/**
	 * A nonce value used to associate a client session with an ID token, preventing replay attacks.
	 *
	 * @type {string}
	 */
	nonce?: string;

	/**
	 * The Authentication Context Class Reference, indicating the authentication methods used.
	 *
	 * @type {string}
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
	 */
	azp?: string;

	/**
	 * Session ID for the user, which can be used to manage user sessions.
	 *
	 * @type {string}
	 */
	sid?: string;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
};

export type LogoutTokenClaims = {
	iss?: string;
	sub?: string;
	aud?: string | string[];
	iat?: number;
	jti?: string;
	sid?: string;
	nonce?: string;
	events?: Record<string, unknown>;
};

export type SessionData = {
	/**
	 * The state parameter used in the authentication request.
	 * @type {string | null}
	 */
	state?: string | null;

	/**
	 * The authorization code returned by the authorization server.
	 * @type {string | null}
	 */
	code?: string | null;

	/**
	 * The error returned during the authentication process, if any.
	 * @type {string | null}
	 */
	error?: string | null;

	/**
	 * A description of the error returned during authentication.
	 * @type {string | null}
	 */
	error_description?: string | null;

	/**
	 * A URI identifying a human-readable web page with information about the error (RFC 6749).
	 * @type {string | null}
	 */
	error_uri?: string | null;

	/**
	 * Opaque value representing the session state at the authorization server (OIDC Session Management).
	 * @type {string | null}
	 */
	session_state?: string | null;

	/**
	 * The ID token issued by the authorization server.
	 * @type {string | null}
	 */
	id_token?: string | null;

	/**
	 * The access token issued by the authorization server.
	 * @type {string | null}
	 */
	access_token?: string | null;

	/**
	 * The refresh token issued by the authorization server.
	 * @type {string | null}
	 */
	refresh_token?: string | null;

	/**
	 * The type of token issued, defaulting to 'bearer'.
	 * @type {string}
	 */
	token_type?: string;

	/**
	 * The scope of the issued token.
	 * @type {string | null}
	 */
	scope?: string | null;

	/**
	 * The lifetime of the access token in seconds, as returned by the token endpoint.
	 * @type {number | null}
	 */
	expires_in?: number | null;

	/**
	 * The absolute expiration time of the access token, represented as a Unix timestamp (seconds since epoch).
	 * @type {number | null}
	 */
	expires_at?: number | null;

	/**
	 * The claims associated with the ID token.
	 * @type {IdTokenClaims | null}
	 */
	claims?: IdTokenClaims | null;
};

export type StateData = {
	/**
	 * A unique identifier for the state.
	 * @type {string}
	 */
	id: string;

	/**
	 * The timestamp when the state was created, represented as a Unix timestamp (seconds since epoch).
	 * @type {number}
	 */
	createdAt: number;

	/**
	 * The code verifier used in the PKCE flow.
	 * @type {string}
	 */
	codeVerifier: string;

	/**
	 * The code challenge derived from the code verifier, used in the PKCE flow.
	 * @type {string}
	 */
	codeChallenge: string;

	/**
	 * A unique nonce value used to associate a client session with an ID token, preventing replay attacks.
	 * @type {string}
	 */
	nonce: string;
};

export type CallbackParams = {
	/**
	 * The authorization code returned by the authorization server (query mode).
	 *
	 * @type {string | null}
	 */
	code?: string | null;

	/**
	 * The granted scopes returned by the authorization server.
	 *
	 * @type {string | null}
	 */
	scope?: string | null;

	/**
	 * The state parameter echoed back from the authorization request, used to prevent CSRF attacks.
	 *
	 * @type {string | null}
	 */
	state?: string | null;

	/**
	 * The error code returned by the authorization server if the request failed.
	 *
	 * @type {string | null}
	 */
	error?: string | null;

	/**
	 * A human-readable description of the error.
	 *
	 * @type {string | null}
	 */
	error_description?: string | null;

	/**
	 * A URI identifying a human-readable web page with information about the error (RFC 6749).
	 *
	 * @type {string | null}
	 */
	error_uri?: string | null;

	/**
	 * Opaque value representing the session state at the authorization server (OIDC Session Management).
	 *
	 * @type {string | null}
	 */
	session_state?: string | null;
};

export type LogoutParams = {
	/**
	 * The URL to which the user should be redirected after logging out.
	 *
	 * @type {string}
	 */
	postLogoutRedirectUri?: string;
};

export type ExtraRequestArgs = {
	/**
	 * Specifies the type of prompt to display to the user during authentication or authorization.
	 *
	 * @type {string}
	 * @example 'none' | 'login' | 'create'
	 */
	prompt?: string;

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
	 * A list of BCP 47 language tags specifying the preferred display language for the customer-facing UI.
	 *
	 * We uses this as a fallback when determining the display language.
	 * It is only applied if no higher-priority signal is present.
	 *
	 * @see https://docs.strivacity.com/docs/translations
	 * @type {Array<string>}
	 * @example ['en-US', 'fr-FR', 'de-DE']
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

export type EntryResponse = {
	/**
	 * The session ID associated with the entry flow. This is a unique identifier for the session and can be used to track or manage the session.
	 *
	 * @type {string}
	 */
	session_id: string;

	/**
	 * The short application ID associated with the entry flow. This is a unique identifier for the application and can be used to identify the application in various contexts.
	 *
	 * @type {string}
	 */
	short_app_id: string;

	/**
	 * The language code associated with the entry flow. This indicates the preferred language for the user interface and can be used to provide localized content.
	 *
	 * @type {string}
	 */
	language: string;

	[key: string]: string;
};

export type RedirectOptions = {
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

export type SDKOptions = {
	/**
	 * The mode of operation for the SDK, which determines how authentication flows are handled.
	 *
	 * @type {'popup' | 'redirect' | 'native' | 'embedded'}
	 * @default 'redirect'
	 */
	mode: 'popup' | 'redirect' | 'native' | 'embedded';

	/**
	 * The issuer of the tokens, typically the URL of the authorization server.
	 *
	 * @type {string}
	 */
	issuer: string;

	/**
	 * The client ID issued by the authorization server, used to identify the application.
	 *
	 * @type {string}
	 */
	clientId: string;

	/**
	 * The URI to which the user will be redirected after authentication or authorization.
	 *
	 * @type {string}
	 */
	redirectUri: string;

	/**
	 * A list of scopes requested by the application, defining the access levels for the tokens.
	 *
	 * @type {Array<string>}
	 * @default ['openid']
	 */
	scopes: Array<string>;

	/**
	 * The type of response expected from the authorization server.
	 *
	 * @type {ResponseType}
	 * @default 'code'
	 */
	responseType: ResponseType;

	/**
	 * The mode in which the response is returned from the authorization server.
	 *
	 * @type {ResponseMode}
	 * @default 'query'
	 */
	responseMode: ResponseMode;

	/**
	 * The storage mechanism used to save and retrieve authentication information.
	 *
	 * @type {SDKStorage}
	 * @default LocalStorage
	 */
	storage: SDKStorage;

	/**
	 * The storage mechanism used to save and retrieve state information, such as the state parameter in OAuth flows.
	 *
	 * @type {SDKStorage}
	 * @default LocalStorage
	 */
	stateStorage: SDKStorage;

	/**
	 * The name of the storage token used to store session data.
	 *
	 * @type {string}
	 * @default 'sty.session'
	 */
	storageTokenName: string;

	/**
	 * The HTTP client used for making requests to the authorization server and other endpoints.
	 *
	 * @type {SDKHttpClient}
	 */
	httpClient: SDKHttpClient;

	/**
	 * The logging mechanism used for logging messages and errors.
	 *
	 * @type {SDKLogging}
	 */
	logging?: SDKLogging;

	/**
	 * Indicates whether the SDK should be lazily loaded, meaning that it will be initialized only when needed.
	 *
	 * @type {boolean}
	 * @default false
	 */
	lazyLoad: boolean;

	/**
	 * Indicates whether the SDK should automatically refresh tokens when they are about to expire.
	 *
	 * @type {boolean}
	 * @default true
	 */
	autoRefresh: boolean;

	/**
	 * Indicates whether the SDK should automatically handle the callback from the authorization server after authentication or authorization.
	 * Only available in embedded and native mode.
	 *
	 * @type {boolean}
	 * @default false
	 */
	redirectForTokenExchange: boolean;

	/**
	 * A function that fetches and caches the metadata options from the authorization server.
	 *
	 * @returns {Promise<MetadataOptions>} A promise that resolves to the metadata options.
	 */
	getMetadata: () => Promise<MetadataOptions>;

	/**
	 * Handles the URL redirection to the specified target.
	 * You can use this method to implement custom URL handling logic, such as opening a new window or navigating to a different page.
	 *
	 * @param {string | URL} url - The URL to handle.
	 * @param {Record<string, unknown>} params - Optional parameters for redirection.
	 * @returns - A promise that resolves when the redirection is handled.
	 */
	urlHandler: (url: string | URL, params?: Record<string, unknown>) => Promise<unknown>;

	/**
	 * Handles the callback from the authorization server after a successful authentication or authorization.
	 * You can use this method to implement custom logic for processing the response from the authorization server.
	 *
	 * @param {string | URL} url - The URL containing the response from the authorization server.
	 * @param {ResponseMode} [responseMode] - Optional parameter specifying the response mode (query or fragment).
	 * @returns - A promise that resolves when the callback is handled.
	 */
	callbackHandler: (url: string | URL, responseMode?: ResponseMode) => Promise<unknown>;
};

export type SDKInitConfig = Partial<SDKOptions> & Required<Pick<SDKOptions, 'mode' | 'issuer' | 'clientId' | 'redirectUri'>>;

export type FlowState = {
	/**
	 * Indicates whether the SDK has been initialized and is ready for use.
	 *
	 * @type {boolean}
	 */
	initialized: boolean;

	/**
	 * The metadata options provided by the authorization server, which may include information about endpoints, supported features, and claims.
	 *
	 * @type {MetadataOptions | null}
	 */
	metadata: MetadataOptions | null;

	/**
	 * The current session data, which may include tokens and related information.
	 *
	 * @type {SessionData | null}
	 */
	session: SessionData | null;

	/**
	 * The unique identifier for the current session, which may be used for tracking and correlation.
	 *
	 * @type {string | null}
	 */
	sessionId: string | null;

	/**
	 * The short application identifier, which may be used for tracking and correlation.
	 *
	 * @type {string | null}
	 */
	shortAppId: string | null;

	/**
	 * The language preference for the authentication flow, which may be used for localization.
	 *
	 * @type {string}
	 * @default navigator.language
	 */
	language: string;
};

export type EventFunctions = {
	accessTokenExpired: (params?: { accessToken?: string | null; refreshToken?: string | null }) => Promise<void> | void;
	init: () => Promise<void> | void;
	loggedIn: (params?: { accessToken?: string | null; refreshToken?: string | null; claims?: IdTokenClaims | null }) => Promise<void> | void;
	loginInitiated: () => Promise<void> | void;
	logoutInitiated: (params?: { idToken?: string | null; claims?: IdTokenClaims | null }) => Promise<void> | void;
	sessionLoaded: (params?: { accessToken?: string | null; refreshToken?: string | null; claims?: IdTokenClaims | null }) => Promise<void> | void;
	tokenRefreshed: (params?: { accessToken?: string | null; refreshToken?: string | null; claims?: IdTokenClaims | null }) => Promise<void> | void;
	tokenRefreshFailed: (params?: { refreshToken?: string | null }) => Promise<void> | void;
	tokenRevoked: (params?: { token?: string | null; tokenTypeHint?: 'refresh_token' | 'access_token' }) => Promise<void> | void;
	tokenRevokeFailed: (params?: { token?: string | null; tokenTypeHint?: 'refresh_token' | 'access_token' }) => Promise<void> | void;
};

export type SDK<URLHandlerParams extends ExtraRequestArgs = ExtraRequestArgs, EntryReturnType = Promise<void>> = {
	/**
	 * The resolved SDK configuration options in use.
	 *
	 * @type {SDKOptions}
	 */
	readonly options: SDKOptions;

	/**
	 * Whether the SDK has been fully initialized.
	 *
	 * @type {boolean}
	 */
	readonly initialized: boolean;

	/**
	 * The storage adapter used to persist session and state data.
	 *
	 * @type {SDKStorage}
	 */
	readonly storage: SDKStorage;

	/**
	 * The HTTP client adapter used for making requests.
	 *
	 * @type {SDKHttpClient}
	 */
	readonly httpClient: SDKHttpClient;

	/**
	 * The optional logging adapter for SDK diagnostic output.
	 *
	 * @type {SDKLogging | undefined}
	 */
	readonly logging?: SDKLogging;

	/**
	 * The current session data, or `null` if no session is active.
	 *
	 * @type {SessionData | null}
	 */
	session: SessionData | null;

	/**
	 * The short application ID associated with the current session, or `null` if not yet available.
	 *
	 * @type {string | null}
	 */
	shortAppId: string | null;

	/**
	 * The unique identifier for the current session, or `null` if no session is active.
	 *
	 * @type {string | null}
	 */
	sessionId: string | null;

	/**
	 * The language code used for the authentication UI.
	 *
	 * @type {string}
	 */
	language: string;

	/**
	 * A promise that resolves to `true` if the user is currently authenticated, `false` otherwise.
	 *
	 * @type {Promise<boolean>}
	 */
	readonly isAuthenticated: Promise<boolean>;

	/**
	 * The current access token, or `null` if the user is not authenticated.
	 *
	 * @type {string | null}
	 */
	readonly accessToken: string | null;

	/**
	 * Indicates whether the current access token has expired.
	 *
	 * @type {boolean}
	 */
	readonly accessTokenExpired: boolean;

	/**
	 * The expiration time of the current access token, represented as a Unix timestamp (seconds since epoch), or `null` if no access token is present.
	 *
	 * @type {number | null}
	 */
	readonly accessTokenExpirationDate: number | null;

	/**
	 * The current refresh token, or `null` if the user is not authenticated.
	 *
	 * @type {string | null}
	 */
	readonly refreshToken: string | null;

	/**
	 * The claims extracted from the current ID token, or `null` if no ID token is present.
	 *
	 * @type {IdTokenClaims | null}
	 */
	readonly idTokenClaims: IdTokenClaims | null;

	/**
	 * Subscribes to a specific SDK event by name.
	 *
	 * @template T - The name of the event to subscribe to.
	 * @param {T} eventName - The name of the event.
	 * @param {Function} callbackFn - The callback to invoke when the event fires.
	 * @returns {{ dispose: () => void }} An object with a `dispose` method to remove the subscription.
	 */
	subscribeToEvent<T extends keyof EventFunctions>(
		eventName: T,
		callbackFn: (...params: Parameters<EventFunctions[T]>) => Promise<void> | void,
	): { dispose: () => void };

	/**
	 * Subscribes to all SDK events.
	 *
	 * @param {Function} callbackFn - The callback to invoke whenever any event fires.
	 * @returns {{ dispose: () => void }} An object with a `dispose` method to remove the subscription.
	 */
	subscribeToAllEvents(callbackFn: (...params: Array<unknown>) => Promise<void> | void): { dispose: () => void };

	/**
	 * Clears the current session data from storage.
	 *
	 * @returns {Promise<void>}
	 */
	cleanupSession(): Promise<void>;

	/**
	 * Replaces the current session data with the provided data.
	 *
	 * @param {SessionData} newData - The new session data to persist.
	 * @returns {Promise<void>}
	 */
	updateSession(newData: SessionData): Promise<void>;

	/**
	 * Checks whether the user is currently authenticated, optionally triggering a token refresh.
	 *
	 * @param {{ autoRefresh: boolean }} [params] - Options for the check.
	 * @returns {Promise<boolean>} Resolves to `true` if authenticated, `false` otherwise.
	 */
	checkAuthentication(params?: { autoRefresh: boolean }): Promise<boolean>;

	/**
	 * Returns the current access token, optionally refreshing it if expired.
	 *
	 * @param {{ autoRefresh: boolean }} [params] - Options controlling whether to auto-refresh.
	 * @returns {Promise<string | null>} The access token, or `null` if unavailable.
	 */
	getAccessToken(params?: { autoRefresh: boolean }): Promise<string | null>;

	/**
	 * Initializes the SDK, loading metadata and restoring any persisted session.
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if the stored session cannot be loaded.
	 */
	init(): Promise<void>;

	/**
	 * Performs a token exchange using the provided parameters.
	 *
	 * @param {Record<string, string>} [params] - Additional parameters for the token exchange request.
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if the token exchange fails or if the provided parameters are invalid.
	 */
	tokenExchange(params?: Record<string, string>): Promise<void>;

	/**
	 * Handles the authentication callback by parsing the response from the given URL.
	 *
	 * @param {string | URL} [url] - The callback URL to process. Defaults to the current page URL if omitted.
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if the callback handling fails or if the URL is invalid.
	 */
	handleCallback(url?: string | URL): Promise<void>;

	/**
	 * Refreshes the current access token using the refresh token.
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if the refresh process fails or if no refresh token is available.
	 */
	refresh(): Promise<void>;

	/**
	 * Revokes the current tokens.
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if the revocation process fails or if no tokens are available to revoke.
	 */
	revoke(): Promise<void>;

	/**
	 * Logs the user out and optionally redirects to a post-logout URI.
	 *
	 * @param {URLHandlerParams & LogoutParams} [params] - Optional logout and URL handler parameters.
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if the logout url handling fails or if the provided parameters are invalid.
	 */
	logout(params?: URLHandlerParams & LogoutParams): Promise<void>;

	/**
	 * Initiates the login flow.
	 *
	 * @param {URLHandlerParams} [params] - Optional parameters for the login request.
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if the login process fails or if the provided parameters are invalid.
	 */
	login(params?: URLHandlerParams): Promise<void>;

	/**
	 * Initiates the registration flow.
	 *
	 * @param {URLHandlerParams} [params] - Optional parameters for the registration request.
	 * @returns {Promise<void>}
	 * @throws {Error} Throws an error if the registration process fails or if the provided parameters are invalid.
	 */
	register(params?: URLHandlerParams): Promise<void>;

	/**
	 * Handles the entry point URL of the authentication flow, typically used for embedded or native modes.
	 *
	 * @param {string | URL} [url] - The entry URL to process.
	 * @param {RedirectOptions} [params] - Optional redirect options.
	 * @returns {EntryReturnType}
	 * @throws {Error} Throws an error if the entry URL is invalid or if the entry process fails.
	 */
	entry(url?: string | URL, params?: RedirectOptions): EntryReturnType;
};
