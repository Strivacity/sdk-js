import type { FlowState, SDKOptions } from '../types/oidc';
import type { NativeFlowState, NativeParams } from '../types/native';
import { buildAuthorizationUrl, finalizeLoginSession, submitLoginForm } from '../utils/oidc';
import { OidcError, ProtocolError, throwHttpError } from '../utils/errors';
import type { createBaseFlow } from '../flows/base';

/**
 * Submits a login form with the provided form ID and request body.
 *
 * @param {object} params - The parameters for the form submission.
 * @param {ReturnType<typeof createBaseFlow>} params.base - The base flow instance.
 * @param {SDKOptions} params.options - The SDK options.
 * @param {FlowState} params.flowState - The current flow state.
 * @param {string} [params.formId] - The ID of the form to be submitted.
 * @param {Record<string, unknown>} [params.body] - The request body to be sent with the form submission.
 * @returns {Promise<NativeFlowState>} A promise that resolves to the login flow state after form submission.
 * @throws {Error} If there is an error during the form submission process.
 */
export async function submitFormHandler({
	base,
	options,
	flowState,
	formId,
	body = {},
}: {
	base: ReturnType<typeof createBaseFlow>;
	options: SDKOptions;
	flowState: FlowState;
	formId?: string;
	body?: Record<string, unknown>;
}): Promise<NativeFlowState> {
	if (!flowState.sessionId) {
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
			sessionId: flowState.sessionId,
			language: flowState.language,
			options,
		});

		const finalizeUrl = data.finalizeUrl?.trim();

		if (finalizeUrl) {
			await finalizeSessionHandler({ url: finalizeUrl, flowState, base, options });
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
 * @param {object} params - The parameters for starting the login session.
 * @param {ReturnType<typeof createBaseFlow>} params.base - The base flow instance.
 * @param {SDKOptions} params.options - The SDK options.
 * @param {FlowState} params.flowState - The current flow state.
 * @param {NativeParams} params.params - The parameters for the login session.
 * @returns {Promise<NativeFlowState | void>} A promise that resolves to the login flow state after starting the session, or void if the session is finalized.
 * @throws {Error} If there is an error during the session start process.
 */
export async function startSessionHandler({
	base,
	options,
	flowState,
	params,
}: {
	base: ReturnType<typeof createBaseFlow>;
	options: SDKOptions;
	flowState: FlowState;
	params: NativeParams;
}): Promise<NativeFlowState | void> {
	if (options.logging) {
		options.logging.xEventId = undefined;
		options.logging.info('Starting login flow session');
	}

	base.dispatchEvent('flowInitiated', []);

	try {
		if (params.sessionId) {
			flowState.sessionId = params.sessionId;
			return await submitFormHandler({ flowState, base, options });
		}

		const serverSessionUri = typeof options.serverSessionUri !== 'boolean' ? options.serverSessionUri : undefined;
		const url = await buildAuthorizationUrl({
			url: serverSessionUri,
			includeOAuthParams: !serverSessionUri,
			persistState: !serverSessionUri,
			params,
			options,
		});

		url.searchParams.set('sdk', 'web');

		const response = await options.httpClient.request<string>(url, {
			method: 'GET',
			credentials: 'include',
			headers: { 'Accept-language': params.language ?? flowState.language },
		});

		if (!response.ok) {
			throwHttpError(response.status, 'Failed to start login session');
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
			throw new OidcError(searchParams.error, searchParams.error_description, searchParams.error_uri);
		}

		if (searchParams.code) {
			if (!uri.toString().startsWith(options.redirectUri)) {
				throw new ProtocolError('Invalid redirect URI');
			}

			if (options.serverSessionUri) {
				globalThis.location.href = uri.toString();
			} else {
				await base.tokenExchange(searchParams);
			}
		} else if (searchParams.session_id) {
			flowState.sessionId = searchParams.session_id;
			flowState.shortAppId = searchParams.short_app_id ?? null;
			flowState.language = searchParams.language ?? flowState.language;

			return await submitFormHandler({ flowState, base, options });
		} else {
			throw new ProtocolError('Neither "code" nor "session_id" is present in the response');
		}
	} catch (error) {
		options.logging?.error('Start login session error', error);
		throw error;
	}
}

/**
 * Finalizes the login session by exchanging the authorization code for tokens.
 *
 * @param {object} params - The parameters for finalizing the login session.
 * @param {ReturnType<typeof createBaseFlow>} params.base - The base flow instance.
 * @param {SDKOptions} params.options - The SDK options.
 * @param {FlowState} params.flowState - The current flow state.
 * @param {string | URL} params.url - The URL containing the authorization code.
 * @returns {Promise<void>} A promise that resolves when the session is finalized.
 * @throws {Error} If the session ID is missing or if there is an error during the finalization process.
 */
export async function finalizeSessionHandler({
	base,
	options,
	flowState,
	url,
}: {
	base: ReturnType<typeof createBaseFlow>;
	options: SDKOptions;
	flowState: FlowState;
	url: string | URL;
}): Promise<void> {
	options.logging?.debug('Finalizing login session');

	if (!flowState.sessionId) {
		const error = new Error('Session ID is missing. Cannot finalize login session.');
		options.logging?.error('Failed to finalize login session', error);
		throw error;
	}

	try {
		const redirectUri = await finalizeLoginSession({
			url,
			sessionId: flowState.sessionId,
			language: flowState.language,
			options,
		});

		if (options.serverSessionUri) {
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
