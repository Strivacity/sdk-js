import type { SDKOptions, SDKStorage, SessionData, StateData } from '@strivacity/sdk-core/types';
import type { createBaseFlow } from '@strivacity/sdk-core/flows/base';
import { vi, type MockInstance } from 'vitest';
import type { HttpClientResponse, SDKHttpClient, SDKLogging, ServerAdapter, ServerSDKInitConfig, ServerStorage } from '../../../packages/sdk-core/src/types';
import { createSession, createState, timestamp, createHttpClient, serializeState } from '../../../packages/sdk-core/src/utils';
import { redirectUrlHandler, redirectCallbackHandler } from '../../../packages/sdk-core/src/handlers';
import { createBaseServerSDK } from '../../../packages/sdk-core/src/server/base';

export type MockEvent = { request: Request };

export type MockStorage = {
	data: Map<string, string>;
	spies: { get: MockInstance; set: MockInstance; delete: MockInstance };
	clear: () => void;
	keys: () => Array<string>;
	values: () => Array<string>;
	getFirstKey: () => string | undefined;
	getLastKey: () => string | undefined;
	getLastState: () => StateData | undefined;
	getSession: (key?: string) => SessionData | undefined;
	generateState: (overrides?: Partial<StateData>, store?: boolean) => Promise<StateData>;
	generateSession: (overrides?: Partial<SessionData>, storageKey?: string | null) => SessionData;
};

const mockStorages = new WeakMap<SDKStorage, MockStorage>();

export const serverAdapter: ServerAdapter<MockEvent> = {
	toRequest: (event) => event.request,
};

export async function seedState(stateStorage: SDKStorage, overrides: Partial<StateData> = {}): Promise<StateData> {
	const state = await createState();
	Object.assign(state, overrides);
	await stateStorage.set(`sty.${state.id}`, serializeState(state));

	return state;
}

export function createSessionData(overrides: Record<string, unknown> = {}): SessionData {
	return createSession({ access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 3600, ...overrides });
}

export function createMockEvent(url = 'https://brandtegrity.io'): MockEvent {
	return { request: new Request(url) };
}

export function getMockStorage(storage: SDKStorage): MockStorage {
	const record = mockStorages.get(storage);

	if (!record) {
		throw new Error('The provided storage was not created by createMockStorage()');
	}

	return record;
}

export function createMockLogging(): SDKLogging {
	return {
		xEventId: undefined,
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

export function createMockHttpClient(): SDKHttpClient {
	return {
		request: vi.fn(),
		sendTokenRequest: vi.fn(),
	};
}

export function createMockStorage(): SDKStorage {
	const data = new Map<string, string>();
	const storage: SDKStorage = {
		get: vi.fn((key: string) => Promise.resolve(data.get(key) ?? null)),
		set: vi.fn((key: string, value: string) => {
			data.set(key, value);

			return Promise.resolve();
		}),
		delete: vi.fn((key: string) => {
			data.delete(key);

			return Promise.resolve();
		}),
	};

	mockStorages.set(storage, {
		data,
		spies: {
			get: storage.get as unknown as MockInstance,
			set: storage.set as unknown as MockInstance,
			delete: storage.delete as unknown as MockInstance,
		},
		clear: () => data.clear(),
		keys: () => Array.from(data.keys()),
		values: () => Array.from(data.values()),
		getFirstKey: () => Array.from(data.keys())[0],
		getLastKey: () => Array.from(data.keys()).at(-1),
		getLastState: () => {
			const key = Array.from(data.keys())
				.reverse()
				.find((key) => key.startsWith('sty.') && key !== 'sty.session');

			return key ? (JSON.parse(data.get(key)!) as StateData) : undefined;
		},
		getSession: (key = 'sty.session') => {
			const value = data.get(key);

			return value ? (JSON.parse(value) as SessionData) : undefined;
		},
		generateState: async (overrides, store = true) => {
			const state = await createState();

			Object.assign(state, overrides);

			if (store) {
				data.set(`sty.${state.id}`, JSON.stringify(state));
			}

			return state;
		},
		generateSession: (overrides, storageKey = 'sty.session') => {
			const session = createSession();

			session.access_token = `${crypto.randomUUID().replace(/-/g, '')}.${crypto.randomUUID().replace(/-/g, '')}`;
			session.refresh_token = `${crypto.randomUUID().replace(/-/g, '')}.${crypto.randomUUID().replace(/-/g, '')}`;
			session.scope = 'openid profile';
			session.expires_in = 3600;
			session.expires_at = timestamp() + 3600;
			session.claims = {
				iss: 'https://brandtegrity.io/',
				aud: [crypto.randomUUID().replace(/-/g, '')],
				nonce: crypto.randomUUID().replace(/-/g, ''),
				auth_time: timestamp(),
				exp: timestamp(),
				iat: timestamp(),
				jti: crypto.randomUUID(),
				sid: crypto.randomUUID(),
				sub: crypto.randomUUID(),
			};

			Object.assign(session, overrides);

			if (storageKey) {
				data.set(storageKey, JSON.stringify(session));
			}

			return session;
		},
	});

	return storage;
}

export function createOptions<T = unknown>(overrides?: Partial<SDKOptions>): SDKOptions {
	return {
		mode: 'redirect',
		issuer: 'https://brandtegrity.io',
		clientId: 'client-id',
		redirectUri: 'https://brandtegrity.io/callback',
		scopes: ['openid'],
		responseType: 'code',
		responseMode: 'query',
		storage: createMockStorage(),
		stateStorage: createMockStorage(),
		storageTokenName: 'sty.session',
		logging: createMockLogging(),
		httpClient: createHttpClient(),
		urlHandler: redirectUrlHandler,
		callbackHandler: redirectCallbackHandler,
		lazyLoad: false,
		autoRefresh: true,
		discoveryDocumentCacheTTL: 3600,
		jwksCacheTTL: 600,
		serverSessionUri: false,
		...overrides,
	};
}

export function createServerMockStorage(): ServerStorage<MockEvent> {
	return { ...createMockStorage(), deleteByLogoutToken: vi.fn().mockResolvedValue(undefined) };
}

export function createServerOptions(overrides: Partial<ServerSDKInitConfig<MockEvent>> = {}): ServerSDKInitConfig<MockEvent> {
	return {
		mode: 'redirect',
		issuer: 'https://brandtegrity.io',
		clientId: 'client-id',
		redirectUri: 'https://brandtegrity.io/callback',
		scopes: ['openid'],
		logging: createMockLogging(),
		secret: 'secret',
		...overrides,
	};
}

export function createServerSDK(overrides: Partial<ServerSDKInitConfig<MockEvent>> = {}) {
	const storage = overrides.storage ?? createMockStorage();
	const stateStorage = overrides.stateStorage ?? createMockStorage();
	const options = createServerOptions({ ...overrides, storage, stateStorage });
	const sdk = createBaseServerSDK(serverAdapter, options);

	return { sdk, options: sdk.options, storage, stateStorage };
}

export function createFakeBaseFlow(): ReturnType<typeof createBaseFlow> {
	return {
		dispatchEvent: vi.fn(),
		tokenExchange: vi.fn().mockResolvedValue(undefined),
	} as unknown as ReturnType<typeof createBaseFlow>;
}

export function createMockFlow<T = unknown>(overrides?: Record<string, unknown>): T {
	return {
		options: {},
		initialized: true,
		storage: {},
		httpClient: {},
		logging: createMockLogging(),
		isAuthenticated: Promise.resolve(false),
		isAuthenticatedSync: false,
		accessToken: null,
		accessTokenExpired: true,
		accessTokenExpirationDate: null,
		refreshToken: null,
		idToken: null,
		idTokenClaims: null,
		language: 'en-US',
		session: null,
		init: vi.fn().mockResolvedValue(undefined),
		subscribeToEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		subscribeToAllEvents: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		checkAuthentication: vi.fn().mockResolvedValue(true),
		tokenExchange: vi.fn().mockResolvedValue(undefined),
		handleCallback: vi.fn().mockResolvedValue(undefined),
		refresh: vi.fn().mockResolvedValue(undefined),
		revoke: vi.fn().mockResolvedValue(undefined),
		logout: vi.fn().mockResolvedValue(undefined),
		login: vi.fn().mockResolvedValue(undefined),
		register: vi.fn().mockResolvedValue(undefined),
		entry: vi.fn().mockResolvedValue(undefined),
		startSession: vi.fn().mockResolvedValue(undefined),
		finalizeSession: vi.fn().mockResolvedValue(undefined),
		submitForm: vi.fn().mockResolvedValue(undefined),
		...overrides,
	} as unknown as T;
}

export function createMockBaseServerSDK<T = unknown>(overrides?: Record<string, unknown>): T {
	return {
		options: {},
		getSession: vi.fn().mockResolvedValue(null),
		updateSession: vi.fn().mockResolvedValue(undefined),
		refreshSession: vi.fn().mockResolvedValue(undefined),
		revokeSession: vi.fn().mockResolvedValue(undefined),
		getEntrySession: vi.fn().mockResolvedValue({}),
		completeLogin: vi.fn().mockResolvedValue(undefined),
		logout: vi.fn().mockResolvedValue(new URL('https://brandtegrity.io')),
		handleLogin: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
		handleRegister: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
		handleCallback: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
		handleRefresh: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
		handleRevoke: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
		handleEntry: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
		handleLogout: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
		handleBackChannelLogout: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
		handler: vi.fn().mockResolvedValue(null),
		...overrides,
	} as unknown as T;
}

export function createHttpResponse(overrides: Partial<HttpClientResponse<unknown>> = {}): HttpClientResponse<unknown> {
	return {
		headers: new Headers(),
		ok: true,
		status: 200,
		statusText: 'OK',
		url: 'https://brandtegrity.io',
		body: null,
		json: () => Promise.resolve({}),
		text: () => Promise.resolve(''),
		...overrides,
	};
}

export function getPostLogoutTokenRequest(logoutToken: string): MockEvent {
	return {
		request: new Request('https://brandtegrity.io/auth/backchannel-logout', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ logout_token: logoutToken }).toString(),
		}),
	};
}
