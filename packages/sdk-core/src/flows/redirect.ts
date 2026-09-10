import type { SDKInitConfig } from '../types/oidc';
import type { RedirectOptions, RedirectFlow } from '../types/redirect';
import { getDefaultFlowState, getSDKOptions, buildAuthorizationUrl } from '../utils/oidc';
import { isSessionExpired } from '../utils/session';
import { createBaseFlow } from './base';

/**
 * Creates a redirect flow for the Strivacity SDK, providing functionality for managing authentication sessions in a redirect context.
 *
 * @param initConfig - The initial configuration for the SDK, including issuer, clientId, redirectUri, and other options.
 * @returns An object implementing the RedirectFlow interface, with methods for login, registration, and entry flows.
 */
export function createRedirectFlow(initConfig: SDKInitConfig): RedirectFlow {
	const flowState = getDefaultFlowState();
	const options = getSDKOptions(initConfig);
	const base = createBaseFlow(flowState, options);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { dispatchEvent: _, ...exposedBase } = base;

	async function login(params: Parameters<RedirectFlow['login']>[0] = {}): ReturnType<RedirectFlow['login']> {
		await base.init();

		const serverSessionUri = typeof options.serverSessionUri !== 'boolean' ? options.serverSessionUri : undefined;
		const url = await buildAuthorizationUrl({
			url: serverSessionUri,
			includeOAuthParams: !serverSessionUri,
			persistState: !serverSessionUri,
			params,
			options,
		});

		base.dispatchEvent('loginInitiated', []);
		options.logging?.debug('Attempting to redirect for login');

		await options.urlHandler(url, params);
	}

	async function register(params: Parameters<RedirectFlow['register']>[0] = {}): ReturnType<RedirectFlow['register']> {
		return await login({ ...params, prompt: 'create' });
	}

	async function entry(url?: string | URL, params?: RedirectOptions): ReturnType<RedirectFlow['entry']> {
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
			return flowState.initialized;
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
			return flowState.shortAppId;
		},
		set shortAppId(shortAppId: string | null) {
			flowState.shortAppId = shortAppId;
		},
		get sessionId() {
			return flowState.sessionId;
		},
		set sessionId(sessionId: string | null) {
			flowState.sessionId = sessionId;
		},
		get session() {
			return flowState.session;
		},
		set session(session) {
			flowState.session = session;
		},
		get language() {
			return flowState.language;
		},
		set language(lang) {
			flowState.language = lang;
		},
		get isAuthenticated() {
			return base.checkAuthentication();
		},
		get isAuthenticatedSync() {
			return !!flowState.session && !isSessionExpired(flowState.session);
		},
		get accessToken() {
			return flowState.session?.access_token ?? null;
		},
		get accessTokenExpired() {
			return !flowState.session || isSessionExpired(flowState.session);
		},
		get accessTokenExpirationDate() {
			return flowState.session?.expires_at ?? null;
		},
		get refreshToken() {
			return flowState.session?.refresh_token ?? null;
		},
		get idToken() {
			return flowState.session?.id_token ?? null;
		},
		get idTokenClaims() {
			return flowState.session?.claims ?? null;
		},
		login,
		register,
		entry,
	} satisfies RedirectFlow;

	if (!options.lazyLoad) {
		void flow.init();
	}

	return flow;
}
