import type { FlowState, SDKOptions } from '../types/oidc';
import type { EmbeddedParams } from '../types/embedded';
import { buildAuthorizationUrl, finalizeLoginSession } from '../utils/oidc';
import type { createBaseFlow } from '../flows/base';

/**
 * Starts a login session by initiating the authentication flow.
 *
 * @param {object} params
 * @param {EmbeddedParams} params.params - The parameters for the login session.
 * @param {FlowState} params.state - The current flow state.
 * @param {ReturnType<typeof createBaseFlow>} params.base - The base flow instance.
 * @param {SDKOptions} params.options - The SDK options.
 * @returns {Promise<void>} A promise that resolves when the session is started.
 * @throws {Error} If there is an error during the session start process.
 */
export async function startSessionHandler({
	params,
	state,
	base,
	options,
}: {
	params: EmbeddedParams;
	state: FlowState;
	base: ReturnType<typeof createBaseFlow>;
	options: SDKOptions;
}): Promise<void> {
	if (options.logging) {
		options.logging.xEventId = undefined;
		options.logging.info('Starting login flow session');
	}

	base.dispatchEvent('loginInitiated', []);

	try {
		const url = await buildAuthorizationUrl({
			url: params.loginSessionUri,
			includeOAuthParams: !params.loginSessionUri,
			persistState: !params.loginSessionUri,
			params,
			options,
		});

		url.searchParams.append('sdk', 'web-embedded');

		const response = await options.httpClient.request<string>(url, {
			method: 'GET',
			credentials: 'include',
			headers: { 'Accept-language': params.language ?? state.language },
		});

		if (!response.ok) {
			throw new Error(`Failed to start login session: HTTP ${response.status}`);
		}

		let uri: URL;
		let searchParams: Record<string, string> = {};

		try {
			uri = new URL(await response.text());
			searchParams = Object.fromEntries(uri.searchParams.entries());
		} catch {
			uri = new URL(response.url);
			searchParams = Object.fromEntries(uri.searchParams.entries());
		}

		if (searchParams.error) {
			throw new Error(`${searchParams.error}: ${searchParams.error_description}`);
		}

		if (searchParams.code) {
			if (!uri.toString().startsWith(options.redirectUri)) {
				throw new Error('Invalid redirect URI');
			}

			if (options.serverSideSession) {
				globalThis.location.href = uri.toString();
			} else {
				await base.tokenExchange(searchParams);
			}
		} else if (searchParams.session_id) {
			if (!searchParams.short_app_id) {
				throw new Error('short_app_id is missing in the response');
			}

			state.sessionId = searchParams.session_id;
			state.shortAppId = searchParams.short_app_id;
			state.language = searchParams.language ?? state.language;
		} else {
			throw new Error('Neither "code" nor "session_id" is present in the response');
		}
	} catch (error) {
		options.logging?.error('Start login session error', error);
		throw error;
	}
}

/**
 * Finalizes the login session by exchanging the authorization code for tokens.
 *
 * @param {object} params
 * @param {string | URL} params.url - The URL containing the authorization code.
 * @param {FlowState} params.state - The current flow state.
 * @param {ReturnType<typeof createBaseFlow>} params.base - The base flow instance.
 * @param {SDKOptions} params.options - The SDK options.
 * @returns {Promise<void>} A promise that resolves when the session is finalized.
 * @throws {Error} If the session ID is missing or if there is an error during the finalization process.
 */
export async function finalizeSessionHandler({
	url,
	state,
	base,
	options,
}: {
	url: string | URL;
	state: FlowState;
	base: ReturnType<typeof createBaseFlow>;
	options: SDKOptions;
}): Promise<void> {
	// NOTE: Collect session data from the host element if not already set in the state.
	if (!state.sessionId && globalThis.sty.hostElement?.sessionId) {
		state.sessionId = globalThis.sty.hostElement.sessionId;
	}
	if (!state.shortAppId && globalThis.sty.hostElement?.shortAppId) {
		state.shortAppId = globalThis.sty.hostElement.shortAppId;
	}
	if (state.language !== globalThis.sty.hostElement?.lang && globalThis.sty.hostElement?.lang) {
		state.language = globalThis.sty.hostElement.lang;
	}

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

		if (options.serverSideSession) {
			globalThis.location.href = redirectUri.toString();
		} else {
			const params = (await options.callbackHandler(redirectUri, options.responseMode)) as Record<string, string>;
			await base.tokenExchange(params);
		}
	} catch (error) {
		options.logging?.error('Finalize login session error', error);
		throw error;
	}
}
