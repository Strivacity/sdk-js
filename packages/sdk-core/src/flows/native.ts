import type { SDKInitConfig, EntryResponse } from '../types/oidc';
import type { LoginFlowState, NativeFlow, NativeLoginFlow, NativeParams } from '../types/native';
import { getDefaultFlowState, getSDKOptions, fetchFlowEntry } from '../utils/oidc';
import { isSessionExpired } from '../utils/session';
import { startSessionHandler, finalizeSessionHandler, submitFormHandler } from '../handlers/native';
import { createBaseFlow } from './base';

export function createNativeFlow(initConfig: SDKInitConfig): NativeFlow {
	const state = getDefaultFlowState();
	const options = getSDKOptions(state, initConfig);
	const base = createBaseFlow(state, options);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { dispatchEvent: _, ...exposedBase } = base;

	async function submitForm(formId?: string, body: Record<string, unknown> = {}): Promise<LoginFlowState> {
		await base.init();
		return submitFormHandler({ formId, body, state, base, options });
	}

	async function startSession(params: NativeParams = {}): Promise<LoginFlowState | void> {
		await base.init();

		if (options.startSessionHandler) {
			return options.startSessionHandler(params);
		}

		return startSessionHandler({ params, state, base, options });
	}

	async function finalizeSession(url: string | URL): Promise<void> {
		await base.init();

		if (options.finalizeSessionHandler) {
			return options.finalizeSessionHandler(url);
		}

		return finalizeSessionHandler({ url, state, base, options });
	}

	function login(params: NativeParams = {}): NativeLoginFlow {
		return {
			// NOTE: For backward compatibility
			get shortAppId() {
				return state.shortAppId;
			},
			set shortAppId(value) {
				state.shortAppId = value;
			},
			get sessionId() {
				return state.sessionId;
			},
			set sessionId(value) {
				state.sessionId = value;
			},
			get language() {
				return state.language;
			},
			set language(lang) {
				state.language = lang;
			},
			startSession: async (loginParams: NativeParams = {}) => {
				return startSession({ ...params, ...loginParams });
			},
			finalizeSession,
			submitForm,
		};
	}

	function register(params: NativeParams = {}): NativeLoginFlow {
		return login({ ...params, prompt: 'create' });
	}

	async function entry(url?: string | URL): Promise<EntryResponse> {
		await base.init();

		const targetUrl = new URL(url ?? globalThis.window?.location.href);

		options.logging?.debug('Attempting entry flow');

		try {
			const url = new URL('/provider/flow/entry', options.issuer);
			const data = await fetchFlowEntry({ url, params: targetUrl.searchParams, sdkMode: 'web', options });

			options.logging?.debug(`Entry request successful - ${JSON.stringify(data)}`);

			return data;
		} catch (error) {
			options.logging?.error('Entry request failed', error);
			throw error;
		}
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
		startSession,
		finalizeSession,
		submitForm,
		login,
		register,
		entry,
	} satisfies NativeFlow;

	if (!options.lazyLoad) {
		void flow.init();
	}

	return flow;
}
