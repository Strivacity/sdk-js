import type { SDKInitConfig, EntryResponse } from '../types/oidc';
import type { LoginFlowState, NativeFlow, NativeLoginFlow, NativeParams } from '../types/native';
import { getDefaultFlowState, getSDKOptions, fetchFlowEntry, finalizeLoginSession, startLoginSession, submitLoginForm } from '../utils/oidc';
import { isSessionExpired } from '../utils/session';
import { createBaseFlow } from './base';

export async function createNativeFlow(opts: SDKInitConfig): Promise<NativeFlow> {
	const state = getDefaultFlowState();
	const options = getSDKOptions(state, opts);
	const base = createBaseFlow(state, options);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { dispatchEvent: _, ...exposedBase } = base;

	async function startSession(loginParams: NativeParams = {}): Promise<void> {
		await base.init();

		if (options.logging) {
			options.logging.xEventId = undefined;
			options.logging.info('Starting login flow session');
		}

		base.dispatchEvent('loginInitiated', []);

		try {
			if (loginParams.sessionId) {
				state.sessionId = loginParams.sessionId;
				await submitForm();
				return;
			}

			const params = await startLoginSession({
				language: loginParams.language ?? state.language,
				sdkMode: loginParams.sdk ?? 'web',
				loginParams,
				options,
			});

			if (params.code) {
				await base.tokenExchange(params);
			} else if (params.sessionId) {
				state.sessionId = params.sessionId;
				state.shortAppId = params.shortAppId ?? null;

				if (params.language) {
					state.language = params.language;
				}

				await submitForm();
			} else {
				throw new Error('Neither "code" nor "session_id" is present in the response');
			}
		} catch (error) {
			options.logging?.error('Start login session error', error);
			throw error;
		}
	}

	async function finalizeSession(url: string | URL): Promise<void> {
		await base.init();

		options.logging?.debug('Finalizing login session');

		if (!state.sessionId) {
			const error = new Error('Session ID is missing. Cannot finalize login session.');
			options.logging?.error('Failed to finalize login session', error);
			throw error;
		}

		try {
			const redirectUri = await finalizeLoginSession({
				url,
				sessionId: state.sessionId,
				language: state.language,
				options,
			});

			if (options.redirectForTokenExchange) {
				globalThis.window.location.href = redirectUri.toString();
				return;
			}

			const params = (await options.callbackHandler(redirectUri, options.responseMode)) as Record<string, string>;
			await base.tokenExchange(params);
		} catch (error) {
			options.logging?.error('Finalize login session error', error);
			throw error;
		}
	}

	async function submitForm(formId?: string, body: Record<string, unknown> = {}): Promise<LoginFlowState> {
		await base.init();

		if (!state.sessionId) {
			const error = new Error('Session ID is missing. Cannot submit form.');
			options.logging?.error('Failed to submit form', error);
			throw error;
		}

		if (formId) {
			options.logging?.debug(`Submitting form: ${formId}`);
		}

		try {
			const data = await submitLoginForm({
				formId,
				body,
				sessionId: state.sessionId,
				language: state.language,
				options,
			});

			if (data.finalizeUrl) {
				await finalizeSession(data.finalizeUrl);
			} else if (data.screen) {
				options.logging?.info(`Rendering screen: ${data.screen}`);
			}

			return data;
		} catch (error) {
			options.logging?.error('Form submission failed', error);
			throw error;
		}
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
		await flow.init();
	}

	return flow;
}
