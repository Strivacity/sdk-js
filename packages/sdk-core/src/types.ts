export type Mandatory<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PartialRecord<K extends keyof any, T> = {
	[P in K]?: T;
};

// region SDK

export const ResponseTypeList = ['code', 'id_token'] as const;
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

export const PromptTypeList = ['none', 'login', 'create'] as const;
export type PromptType = (typeof PromptTypeList)[number];

export const FallbackModeTypeList = ['redirect', 'popup'] as const;
export type FallbackMode = (typeof FallbackModeTypeList)[number];

export type SigningKey = {
	use: string;
	kty: string;
	kid: string;
	alg: AlgorithmType;
	n: string;
	e: string;
};

export type MetadataOptions = {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	jwks_uri: string;
	subject_types_supported: Array<SubjectType>;
	response_types_supported: Array<string>;
	claims_supported: Array<string>;
	grant_types_supported: Array<GrantType>;
	response_modes_supported: Array<ResponseMode>;
	userinfo_endpoint: string;
	scopes_supported: Array<string>;
	token_endpoint_auth_methods_supported: Array<TokenEndpointAuthMethod>;
	userinfo_signing_alg_values_supported: Array<AlgorithmType>;
	id_token_signing_alg_values_supported: Array<AlgorithmType>;
	id_token_signed_response_alg: Array<AlgorithmType>;
	userinfo_signed_response_alg: Array<AlgorithmType>;
	request_parameter_supported: boolean;
	request_uri_parameter_supported: boolean;
	require_request_uri_registration: boolean;
	claims_parameter_supported: boolean;
	revocation_endpoint: string;
	backchannel_logout_supported: boolean;
	backchannel_logout_session_supported: boolean;
	frontchannel_logout_supported: boolean;
	frontchannel_logout_session_supported: boolean;
	end_session_endpoint: string;
	request_object_signing_alg_values_supported: Array<AlgorithmType>;
	code_challenge_methods_supported: Array<'S256'>;
};

export type JwtClaims = {
	iss?: string;
	sub?: string;
	aud?: string | Array<string>;
	exp?: number;
	nbf?: number;
	iat?: number;
	jti?: string;
};

export type IdTokenClaims = Mandatory<JwtClaims, 'iss' | 'sub' | 'aud' | 'exp' | 'iat'> & {
	auth_time?: number;
	nonce?: string;
	acr?: string;
	amr?: unknown;
	azp?: string;
	sid?: string;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
};

export type SDKOptions = {
	mode?: 'popup' | 'redirect';
	issuer: string;
	clientId: string;
	redirectUri: string;
	scopes?: Array<string>;
	responseType?: ResponseType;
	responseMode?: ResponseMode;
	storageTokenName?: string;
	storage?: SDKStorageType;
};

export abstract class SDKStorage {
	abstract get(key: string): string | null;
	abstract delete(key: string): void;
	abstract set(key: string, value: string): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SDKStorageType = new (...args: Array<any>) => SDKStorage;

export type EventFunctions = {
	accessTokenExpired: (params: { accessToken: string; refreshToken?: string | null }) => Promise<void> | void;
	init: () => Promise<void> | void;
	loggedIn: (params: { accessToken: string; refreshToken?: string | null; claims: IdTokenClaims }) => Promise<void> | void;
	loginInitiated: () => Promise<void> | void;
	logoutInitiated: (params: { idToken: string; claims: IdTokenClaims }) => Promise<void> | void;
	sessionLoaded: (params: { accessToken: string; refreshToken?: string | null; claims: IdTokenClaims }) => Promise<void> | void;
	tokenRefreshed: (params: { accessToken: string; refreshToken: string; claims: IdTokenClaims }) => Promise<void> | void;
	tokenRefreshFailed: (params: { refreshToken: string }) => Promise<void> | void;
	tokenRevoked: (params: { token: string; tokenTypeHint: 'refresh_token' | 'access_token' }) => Promise<void> | void;
	tokenRevokeFailed: (params: { token: string; tokenTypeHint: 'refresh_token' | 'access_token' }) => Promise<void> | void;
};

// endregion

// region Flows

export type ExtraRequestArgs = {
	prompt?: PromptType;
	loginHint?: string;
	acrValues?: Array<string>;
	uiLocales?: Array<string>;
};

export type LogoutOptions = {
	postLogoutRedirectUri?: string;
};

export const SelectOptionTypeList = ['item', 'group'] as const;
export type SelectOptionType = (typeof SelectOptionTypeList)[number];

export type BrandingData = {
	logoUrl: string | null;
	brandName: string | null;
	copyright: string | null;
	privacyPolicyUrl: string | null;
	siteTermsUrl: string | null;
};

export type RedirectParams = ExtraRequestArgs & {
	locationMethod?: 'replace' | 'assign';
	targetWindow?: 'top' | 'self';
};

export type PopupWindowFeatures = {
	left?: number;
	top?: number;
	width?: number;
	height?: number;
	menubar?: boolean | string;
	toolbar?: boolean | string;
	location?: boolean | string;
	status?: boolean | string;
	resizable?: boolean | string;
	scrollbars?: boolean | string;

	[key: string]: boolean | string | number | undefined;
};

export type PopupWindowParams = ExtraRequestArgs & {
	popupWindowFeatures?: PopupWindowFeatures;
	popupWindowTarget?: string;
};

// endregion
