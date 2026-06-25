import type { SDKInitConfig, RedirectOptions } from '../types/oidc';
import type { RedirectFlow } from '../types/redirect';
import { getDefaultFlowState, getSDKOptions, buildAuthorizationUrl } from '../utils/oidc';
import { isSessionExpired } from '../utils/session';
import { createBaseFlow } from './base';

export async function createRedirectFlow(opts: SDKInitConfig): Promise<RedirectFlow> {
	const state = getDefaultFlowState();
	const options = getSDKOptions(state, opts);
	const base = createBaseFlow(state, options);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { dispatchEvent: _, ...exposedBase } = base;

	async function login(params: Parameters<RedirectFlow['login']>[0] = {}): ReturnType<RedirectFlow['login']> {
		await base.init();

		const url = await buildAuthorizationUrl({ params, options });

		base.dispatchEvent('loginInitiated', []);
		options.logging?.debug('Attempting to redirect for login');

		await options.urlHandler(url, params);
	}

	async function register(params: Parameters<RedirectFlow['register']>[0] = {}): ReturnType<RedirectFlow['register']> {
		return await login({ ...params, prompt: 'create' });
	}

	async function entry(url?: string | URL, params?: RedirectOptions): Promise<void> {
		await base.init();

		const entryUrl = new URL(url ?? globalThis.window?.location.href);

		options.logging?.debug('Attempting to redirect for entry');

		await options.urlHandler(new URL(`/provider/entry?${entryUrl.searchParams.toString()}`, options.issuer), params);
	}

	const flow = {
		...exposedBase,
		get options() {
			return options;
		},
		get initialized() {
			return state.initialized;
		},
		get storage() {
			return options.storage;
		},
		get httpClient() {
			return options.httpClient;
		},
		get logging() {
			return options.logging;
		},
		get shortAppId() {
			return state.shortAppId;
		},
		set shortAppId(shortAppId: string | null) {
			state.shortAppId = shortAppId;
		},
		get sessionId() {
			return state.sessionId;
		},
		set sessionId(sessionId: string | null) {
			state.sessionId = sessionId;
		},
		get session() {
			return state.session;
		},
		set session(session) {
			state.session = session;
		},
		get language() {
			return state.language;
		},
		set language(lang) {
			state.language = lang;
		},
		get isAuthenticated() {
			return base.checkAuthentication();
		},
		get isAuthenticatedSync() {
			return state.session && !isSessionExpired(state.session);
		},
		get accessToken() {
			return state.session?.access_token ?? null;
		},
		get accessTokenExpired() {
			return !state.session || isSessionExpired(state.session);
		},
		get accessTokenExpirationDate() {
			return state.session?.expires_at ?? null;
		},
		get refreshToken() {
			return state.session?.refresh_token ?? null;
		},
		get idTokenClaims() {
			return state.session?.claims ?? null;
		},
		login,
		register,
		entry,
	} satisfies RedirectFlow;

	if (!options.lazyLoad) {
		await flow.init();
	}

	return flow;
}
