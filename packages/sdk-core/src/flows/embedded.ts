import type { SDKInitConfig } from '../types/oidc';
import type { EmbeddedFlow, EmbeddedParams } from '../types/embedded';
import { getDefaultFlowState, getSDKOptions, fetchFlowEntry } from '../utils/oidc';
import { isSessionExpired } from '../utils/session';
import { startSessionHandler, finalizeSessionHandler } from '../handlers/embedded';
import { createBaseFlow } from './base';

let activeFlow: EmbeddedFlow | undefined;

/**
 * Publishes the embedded flow on `globalThis.sty.oidcService` behind a tamper-resistant proxy.
 *
 * The proxy is created only once per page and locked down with `writable: false, configurable: false`,
 * so no other script can replace it or redefine/override its members (e.g. hijack `login`) to exfiltrate
 * credentials or tokens. Re-initialization (calling `createEmbeddedFlow` again) still works, since reads
 * are always forwarded to the current `activeFlow` closure variable.
 *
 * @param flow - The embedded flow instance to expose.
 */
function publishGlobalBridge(flow: EmbeddedFlow): void {
	globalThis.sty ??= {};
	activeFlow = flow;

	if (globalThis.sty.oidcService) {
		return;
	}

	Object.defineProperty(globalThis.sty, 'oidcService', {
		value: new Proxy({} as EmbeddedFlow, {
			get: (_target, prop) => Reflect.get(activeFlow as object, prop, activeFlow),
			has: (_target, prop) => Reflect.has(activeFlow as object, prop),
			ownKeys: () => Reflect.ownKeys(activeFlow as object),
			getOwnPropertyDescriptor: (_target, prop) => Reflect.getOwnPropertyDescriptor(activeFlow as object, prop),
			set: () => false,
			defineProperty: () => false,
			deleteProperty: () => false,
			setPrototypeOf: () => false,
		}),
		writable: false,
		configurable: false,
		enumerable: true,
	});
}

/**
 * Creates an embedded flow for the Strivacity SDK, providing functionality for managing authentication sessions in an embedded context.
 *
 * @param initConfig - The initial configuration for the SDK, including issuer, clientId, redirectUri, and other options.
 * @returns An object implementing the EmbeddedFlow interface, with methods for starting and finalizing sessions, as well as login and registration flows.
 */
export function createEmbeddedFlow(initConfig: SDKInitConfig): EmbeddedFlow {
	const flowState = getDefaultFlowState();
	const options = getSDKOptions(initConfig);
	const base = createBaseFlow(flowState, options);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { dispatchEvent: _, ...exposedBase } = base;

	async function startSession(params: EmbeddedParams = {}): ReturnType<EmbeddedFlow['startSession']> {
		await base.init();

		return startSessionHandler({ base, options, flowState, params });
	}

	async function finalizeSession(url: string | URL): ReturnType<EmbeddedFlow['finalizeSession']> {
		await base.init();

		return finalizeSessionHandler({ base, options, flowState, url });
	}

	function login(params: EmbeddedParams = {}): ReturnType<EmbeddedFlow['login']> {
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
			startSession: async (loginParams: EmbeddedParams = {}) => {
				return startSession({ ...params, ...loginParams });
			},
			finalizeSession,
		};
	}

	function register(params: EmbeddedParams = {}): ReturnType<EmbeddedFlow['register']> {
		return login({ ...params, prompt: 'create' });
	}

	async function entry(url?: string | URL): ReturnType<EmbeddedFlow['entry']> {
		await base.init();

		const targetUrl = new URL(url ?? globalThis.window?.location.href);

		options.logging?.debug('Attempting entry request');

		try {
			const url = new URL('/provider/flow/entry', options.issuer);
			const data = await fetchFlowEntry({ url, params: targetUrl.searchParams, sdkMode: 'web-embedded', options });

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
		login,
		register,
		entry,
	} satisfies EmbeddedFlow;

	if (!options.lazyLoad) {
		void flow.init();
	}

	if (globalThis.window) {
		publishGlobalBridge(flow);
	}

	return flow;
}
