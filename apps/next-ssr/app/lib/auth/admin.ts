import { sdk } from './server';

export type Authenticator = {
	id: string;
	type: string;
	subType: string;
	target: string;
	createdAt: string;
	lastUsedAt: string | null;
	methods: string[];
	publicMetadata: Record<string, unknown>;
};

export type AccountData = {
	authenticators: {
		methods: Authenticator[];
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
};

export type CustomMFA = {
	id: string;
	name: string;
	description: string;
	methods: Array<string>;
};

export type EnrollTokenData = {
	accountId: string;
	identityStore: string;
	expiresAt: number;
};

export type IntrospectionResult = {
	active: boolean;
	sub?: string;
	client_id?: string;
	scope?: string;
	exp?: number;
	iat?: number;
	iss?: string;
	[key: string]: unknown;
};

export const CUSTOM_MFA_ID = 'b0c3efb0-b82f-42a2-a4fc-8a454a9049e3';

/**
 * Fetches an admin access token using client credentials flow.
 * Caches the token in the global store to avoid unnecessary requests.
 *
 * @returns A promise that resolves with the admin access token.
 */
async function getAdminToken(): Promise<string> {
	const issuer = process.env.VITE_ISSUER?.replace(/\/$/, '');
	const clientId = process.env.VITE_ADMIN_CLIENT_ID;
	const clientSecret = process.env.VITE_ADMIN_CLIENT_SECRET;
	const scopes = process.env.VITE_ADMIN_SCOPES;
	const cacheKey = 'admin_access_token';
	const expiresKey = 'admin_access_token_expires_at';

	if (!issuer || !clientId || !clientSecret || !scopes) {
		throw new Error('Missing admin client credentials environment variables (VITE_ISSUER, VITE_ADMIN_CLIENT_ID, VITE_ADMIN_CLIENT_SECRET, VITE_ADMIN_SCOPES)');
	}

	const cachedToken = globalThis.sty.accessTokenStore.get(cacheKey);
	const cachedExpiresAt = globalThis.sty.accessTokenStore.get(expiresKey);

	if (cachedToken && cachedExpiresAt && Date.now() < Number(cachedExpiresAt)) {
		return cachedToken;
	}

	const response = await sdk.httpClient.request<{ access_token: string; expires_in: number }>(`${issuer}/oauth2/token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
		},
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			audience: issuer,
			scope: scopes,
		}).toString(),
	});

	const { access_token: adminToken, expires_in } = await response.json();

	if (globalThis.sty.accessTokenStore) {
		globalThis.sty.accessTokenStore.set(cacheKey, adminToken);
		// NOTE: Expiry 30s early to avoid edge cases
		globalThis.sty.accessTokenStore.set(expiresKey, String(Date.now() + (expires_in - 30) * 1000));
	}

	return adminToken;
}

/**
 * Returns the introspection result for the given access token.
 * Caches the result in the global store to avoid unnecessary requests.
 *
 * @param {object} params
 * @param {string} params.token - The access token to introspect.
 * @returns {Promise<IntrospectionResult>}
 */
export async function introspectToken({ token }: { token: string }): Promise<IntrospectionResult> {
	const cacheKey = `introspect:${token}`;
	const cached = globalThis.sty.accessTokenStore.get(cacheKey);

	if (cached) {
		const parsed = JSON.parse(cached) as { result: IntrospectionResult; expiresAt: number };

		if (Date.now() < parsed.expiresAt) {
			return parsed.result;
		}

		globalThis.sty.accessTokenStore.delete(cacheKey);
	}

	const response = await sdk.httpClient.request<IntrospectionResult>(new URL('/oauth2/introspect', process.env.VITE_ISSUER), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Bearer ${await getAdminToken()}`,
		},
		body: new URLSearchParams({ token }).toString(),
	});

	const result = await response.json();

	if (result.active === false) {
		throw new Error('Token is inactive');
	}

	if (globalThis.sty.accessTokenStore && result.active && result.exp) {
		// Cache until token expiry (30s early)
		globalThis.sty.accessTokenStore.set(cacheKey, JSON.stringify({ result, expiresAt: result.exp * 1000 - 30_000 }));
	}

	return result;
}

/**
 * Fetches account data including authenticators for the given account.
 *
 * @param {object} params
 * @param {string} params.accountId - The account ID to fetch data for.
 * @param {string} [params.identityStore='Default'] - The identity store name.
 * @returns {Promise<AccountData>}
 */
export async function fetchAccountData({ accountId, identityStore = 'Default' }: { accountId: string; identityStore?: string }): Promise<AccountData> {
	const response = await sdk.httpClient.request<AccountData>(
		new URL(`/admin/api/v1/identityStores/${identityStore}/accounts/${accountId}`, process.env.VITE_ISSUER),
		{
			method: 'GET',
			headers: {
				Authorization: `Bearer ${await getAdminToken()}`,
			},
		},
	);

	return response.json();
}

/**
 * Generates a one-time temporary enroll token and stores it in the global store.
 *
 * @param {object} params
 * @param {string} params.accountId - The account ID to associate with the token.
 * @param {string} [params.identityStore='Default'] - The identity store name.
 * @param {number} [params.ttlMs=300000] - Token time-to-live in milliseconds (default: 5 minutes).
 * @returns {{ token: string; expiresAt: number }}
 */
export function generateEnrollToken({
	accountId,
	identityStore = 'Default',
	ttlMs = 5 * 60 * 1000,
}: {
	accountId: string;
	identityStore?: string;
	ttlMs?: number;
}): {
	token: string;
	expiresAt: number;
} {
	const token = `pm.${crypto.randomUUID()}`;
	const expiresAt = Date.now() + ttlMs;

	globalThis.sty.accessTokenStore.set(token, JSON.stringify({ accountId, identityStore, expiresAt } satisfies EnrollTokenData));

	return { token, expiresAt };
}

/**
 * Looks up and consumes a one-time enroll token from the global store.
 * Deletes the token on successful retrieval
 *
 * @param {object} params
 * @param {string} params.token - The temporary token to consume.
 * @returns {EnrollTokenData | null} The stored enroll data, or `null` if the token is missing or expired.
 */
export function consumeEnrollToken({ token }: { token: string }): EnrollTokenData | null {
	const rawData = globalThis.sty.accessTokenStore.get(token);

	if (!rawData) {
		return null;
	}

	const data = JSON.parse(rawData) as EnrollTokenData;

	// Always delete — expired or not (one-time use)
	globalThis.sty.accessTokenStore.delete(token);

	if (Date.now() > data.expiresAt) {
		return null;
	}

	return data;
}

/**
 * Enrolls a push MFA authenticator for the given account.
 *
 * @param {object} params
 * @param {string} params.accountId - The account ID to enroll the authenticator for.
 * @param {string} params.target - The target identifier for the authenticator.
 * @param {Record<string, unknown>} [params.metadata] - Optional metadata for the authenticator.
 * @param {string} [params.identityStore='Default'] - The identity store name.
 * @returns {Promise<unknown>}
 */
export async function enrollPushMFA({
	accountId,
	target,
	metadata,
	identityStore = 'Default',
}: {
	accountId: string;
	target: string;
	metadata?: Record<string, unknown>;
	identityStore?: string;
}): Promise<unknown> {
	const response = await sdk.httpClient.request<unknown>(
		new URL(`/admin/api/v1/identityStores/${identityStore}/accounts/${accountId}/authenticators`, process.env.VITE_ISSUER),
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${await getAdminToken()}`,
			},
			body: JSON.stringify({
				type: 'custom',
				subType: CUSTOM_MFA_ID,
				publicMetadata: {},
				target,
				metadata,
			}),
		},
	);

	return response.json();
}

/**
 * Disenrolls a push MFA authenticator for the given account.
 *
 * @param {object} params
 * @param {string} params.accountId - The account ID to disenroll the authenticator from.
 * @param {string} params.authenticatorId - The ID of the authenticator to disenroll.
 * @param {string} [params.identityStore='Default'] - The identity store name.
 * @returns {Promise<void>}
 */
export async function disenrollPushMFA({
	accountId,
	authenticatorId,
	identityStore = 'Default',
}: {
	accountId: string;
	authenticatorId: string;
	identityStore?: string;
}): Promise<void> {
	await sdk.httpClient.request<void>(
		new URL(`/admin/api/v1/identityStores/${identityStore}/accounts/${accountId}/authenticators/${authenticatorId}`, process.env.VITE_ISSUER),
		{
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${await getAdminToken()}`,
			},
		},
	);
}
