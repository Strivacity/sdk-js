import type { FlowState, SDKOptions } from '../types/oidc';
import type { LoginFlowState, NativeParams } from '../types/native';
import { buildAuthorizationUrl, finalizeLoginSession, submitLoginForm } from '../utils/oidc';
import type { createBaseFlow } from '../flows/base';

/**
 * Submits a login form with the provided form ID and request body.
 *
 * @param {object} params
 * @param {string} [params.formId] - The ID of the form to be submitted.
 * @param {Record<string, unknown>} [params.body] - The request body to be sent with the form submission.
 * @param {FlowState} params.state - The current flow state.
 * @param {ReturnType<typeof createBaseFlow>} params.base - The base flow instance.
 * @param {SDKOptions} params.options - The SDK options.
 * @returns {Promise<LoginFlowState>} A promise that resolves to the login flow state after form submission.
 * @throws {Error} If there is an error during the form submission process.
 */
export async function submitFormHandler({
	formId,
	body = {},
	state,
	base,
	options,
}: {
	formId?: string;
	body?: Record<string, unknown>;
	state: FlowState;
	base: ReturnType<typeof createBaseFlow>;
	options: SDKOptions;
}): Promise<LoginFlowState> {
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
			await finalizeSessionHandler({ url: data.finalizeUrl, state, base, options });
		} else if (data.screen) {
			options.logging?.info(`Rendering screen: ${data.screen}`);
		}

		return data;
	} catch (error) {
		options.logging?.error('Form submission failed', error);
		throw error;
	}
}

/**
 * Starts a login session by initiating the authentication flow.
 *
 * @param {object} params
 * @param {NativeParams} params.params - The parameters for the login session.
 * @param {FlowState} params.state - The current flow state.
 * @param {ReturnType<typeof createBaseFlow>} params.base - The base flow instance.
 * @param {SDKOptions} params.options - The SDK options.
 * @returns {Promise<LoginFlowState | void>} A promise that resolves to the login flow state after starting the session, or void if the session is finalized.
 * @throws {Error} If there is an error during the session start process.
 */
export async function startSessionHandler({
	params,
	state,
	base,
	options,
}: {
	params: NativeParams;
	state: FlowState;
	base: ReturnType<typeof createBaseFlow>;
	options: SDKOptions;
}): Promise<LoginFlowState | void> {
	if (options.logging) {
		options.logging.xEventId = undefined;
		options.logging.info('Starting login flow session');
	}

	base.dispatchEvent('loginInitiated', []);

	try {
		if (params.sessionId) {
			state.sessionId = params.sessionId;
			return await submitFormHandler({ state, base, options });
		}

		const url = await buildAuthorizationUrl({
			url: params.loginSessionUri,
			includeOAuthParams: !params.loginSessionUri,
			persistState: !params.loginSessionUri,
			params,
			options,
		});

		url.searchParams.append('sdk', 'web');

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
			state.sessionId = searchParams.session_id;
			state.shortAppId = searchParams.short_app_id ?? null;
			state.language = searchParams.language ?? state.language;

			return await submitFormHandler({ state, base, options });
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
			return;
		}

		const params = (await options.callbackHandler(redirectUri, options.responseMode)) as Record<string, string>;
		await base.tokenExchange(params);
	} catch (error) {
		options.logging?.error('Finalize login session error', error);
		throw error;
	}
}
