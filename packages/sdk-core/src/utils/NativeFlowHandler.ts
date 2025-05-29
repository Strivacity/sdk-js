import type { SDKOptions, NativeParams, LoginFlowState } from '../types';
import type { BaseFlow } from '../flows/BaseFlow';
import { HTTPError } from 'ky';
import { State } from './State';
import { FallbackError } from './errors';
import { redirectCallbackHandler } from './handlers';

export class NativeFlowHandler {
	/**
	 * The session ID.
	 *
	 * @type {string | null}
	 */
	protected sessionId: string | null = null;

	constructor(
		/**
		 * The SDK instance.
		 *
		 * @type {SDKStorage}
		 */
		protected sdk: BaseFlow<SDKOptions, NativeParams>,
		/**
		 * Optional parameters for native configuration.
		 *
		 * @type {NativeParams} [options={}]
		 */
		protected params: NativeParams = {},
	) {}

	/**
	 * Starts a new session.
	 *
	 * @param {string} [sessionId] The session ID to start the session with.
	 * @returns {Promise<LoginFlowState>}
	 */
	async startSession(sessionId?: string | null): Promise<LoginFlowState> {
		if (sessionId) {
			this.sessionId = sessionId;
			return this.submitForm();
		}

		const state = await State.create();
		const authorizationUrl = await this.sdk.getAuthorizationUrl(this.params);

		authorizationUrl.searchParams.append('state', state.id);
		authorizationUrl.searchParams.append('code_challenge', state.codeChallenge);
		authorizationUrl.searchParams.append('nonce', state.nonce);

		await this.sdk.storage.set(`sty.${state.id}`, JSON.stringify(state));

		const { url } = await this.sdk.httpClient.get(authorizationUrl, { credentials: 'include' });
		const redirectUri = new URL(url);

		if (redirectUri.searchParams.has('error')) {
			throw new Error(`${redirectUri.searchParams.get('error')}: ${redirectUri.searchParams.get('error_description')}`);
		}

		if (redirectUri.searchParams.has('code')) {
			if (!redirectUri.toString().startsWith(this.sdk.options.redirectUri)) {
				throw new Error('Invalid redirect URI');
			}

			await this.sdk.tokenExchange(redirectCallbackHandler(redirectUri.toString(), this.sdk.options.responseMode || 'fragment'));
		}

		if (!redirectUri.searchParams.has('session_id')) {
			throw new Error('Failed to start a session: "session_id" is missing');
		}

		this.sessionId = redirectUri.searchParams.get('session_id');

		return this.submitForm();
	}

	/**
	 * Finalizes the session using the provided [finalizeUrl].
	 *
	 * @param {string} finalizeUrl The URL to finalize the session.
	 */
	async finalizeSession(finalizeUrl: string): Promise<void> {
		const { url } = await this.sdk.httpClient.get(finalizeUrl, { credentials: 'include' });
		const redirectUri = new URL(url);

		if (!redirectUri.toString().startsWith(this.sdk.options.redirectUri)) {
			throw new Error('Invalid redirect URI');
		}

		await this.sdk.tokenExchange(redirectCallbackHandler(redirectUri.toString(), this.sdk.options.responseMode || 'fragment'));
	}

	/**
	 * Submits a form with the provided [formId] and [data].
	 *
	 * @returns {Promise<LoginFlowState>}
	 */
	async submitForm(formId?: string, data: Record<string, unknown> = {}): Promise<LoginFlowState> {
		let response: LoginFlowState = {};

		try {
			const request = await this.sdk.httpClient.post(new URL(`${this.sdk.options.issuer}/flow/api/v1/${formId ? `form/${formId}` : 'init'}`), {
				credentials: 'include',
				headers: { Authorization: `Bearer ${this.sessionId}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			});

			response = await request.json<LoginFlowState>();

			if (response.finalizeUrl) {
				await this.finalizeSession(response.finalizeUrl);
			} else if (response.hostedUrl && !response.forms && !response.messages) {
				throw new FallbackError(new URL(response.hostedUrl));
			}
		} catch (error) {
			if (error.response?.status === 400 && error instanceof HTTPError) {
				response = await error.response?.json();
			} else {
				response = await error.response?.json();

				if (error.response?.status !== 403 && response?.hostedUrl) {
					throw new FallbackError(new URL(response?.hostedUrl));
				}

				throw error;
			}
		}

		return response;
	}
}
