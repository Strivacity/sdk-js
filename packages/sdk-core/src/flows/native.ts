import type { SDKInitConfig } from '../types/oidc';
import type { NativeFlow, NativeParams } from '../types/native';
import { getDefaultFlowState, getSDKOptions, fetchFlowEntry } from '../utils/oidc';
import { isSessionExpired } from '../utils/session';
import { startSessionHandler, finalizeSessionHandler, submitFormHandler } from '../handlers/native';
import { createBaseFlow } from './base';

/**
 * Creates a native flow for the Strivacity SDK, providing functionality for managing authentication sessions in a native context.
 *
 * @param initConfig - The initial configuration for the SDK, including issuer, clientId, redirectUri, and other options.
 * @returns An object implementing the NativeFlow interface, with methods for starting and finalizing sessions, as well as login and registration flows.
 */
export function createNativeFlow(initConfig: SDKInitConfig): NativeFlow {
	const flowState = getDefaultFlowState();
	const options = getSDKOptions(initConfig);
	const base = createBaseFlow(flowState, options);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { dispatchEvent: _, ...exposedBase } = base;

	async function submitForm(formId?: string, body: Record<string, unknown> = {}): ReturnType<NativeFlow['submitForm']> {
		await base.init();
		return submitFormHandler({ base, options, flowState, formId, body });
	}

	async function startSession(params: NativeParams = {}): ReturnType<NativeFlow['startSession']> {
		await base.init();

		return startSessionHandler({ base, options, flowState, params });
	}

	async function finalizeSession(url: string | URL): ReturnType<NativeFlow['finalizeSession']> {
		await base.init();

		return finalizeSessionHandler({ base, options, flowState, url });
	}

	/**
	 * @deprecated Use `startSession` and `finalizeSession` instead.
	 */
	function login(params: NativeParams = {}): ReturnType<NativeFlow['login']> {
		return {
			// NOTE: For backward compatibility
			get shortAppId() {
				return flowState.shortAppId;
			},
			set shortAppId(value) {
				flowState.shortAppId = value;
			},
			get sessionId() {
				return flowState.sessionId;
			},
			set sessionId(value) {
				flowState.sessionId = value;
			},
			get language() {
				return flowState.language;
			},
			set language(lang) {
				flowState.language = lang;
			},
			startSession: async (loginParams: NativeParams = {}) => {
				return startSession({ ...params, ...loginParams });
			},
			finalizeSession,
			submitForm,
		};
	}

	/**
	 * @deprecated Use `startSession` and `finalizeSession` instead.
	 */
	function register(params: NativeParams = {}): ReturnType<NativeFlow['register']> {
		return login({ ...params, prompt: 'create' });
	}

	async function entry(url?: string | URL): ReturnType<NativeFlow['entry']> {
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
