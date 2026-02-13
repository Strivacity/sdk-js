import type { NativeParams, LoginFlowState } from '../types';
import type { BaseFlow } from '../flows/BaseFlow';
import { State } from './State';
import { FallbackError } from './errors';

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
		protected sdk: BaseFlow,
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
	 * @param {string} [sessionId] - The session ID to start the session with. If not provided, a new session will be created.
	 * @returns {Promise<LoginFlowState | void>}
	 *
	 * @throws {Error} Throws an error if callback handler is not defined, redirect URI is invalid, authorization error occurs, or session ID is missing.
	 */
	async startSession(sessionId?: string | null): Promise<LoginFlowState | void> {
		if (this.sdk.logging) {
			this.sdk.logging.xEventId = undefined;
			this.sdk.logging.info('Starting login flow session');
		}

		if (sessionId) {
			this.sessionId = sessionId;
			return this.submitForm();
		}

		const state = await State.create();
		const authorizationUrl = await this.sdk.getAuthorizationUrl(this.params);

		authorizationUrl.searchParams.append('sdk', this.params.sdk || 'web');
		authorizationUrl.searchParams.append('state', state.id);
		authorizationUrl.searchParams.append('code_challenge', state.codeChallenge);
		authorizationUrl.searchParams.append('nonce', state.nonce);

		await this.sdk.storage.set(`sty.${state.id}`, JSON.stringify(state));

		const response = await this.sdk.httpClient.request(authorizationUrl.toString(), { method: 'GET', credentials: 'include' });

		let uri: URL;

		try {
			uri = new URL(await response.text());
		} catch {
			uri = new URL(response.url);
		}

		if (uri.searchParams.has('code')) {
			if (typeof this.sdk.options.callbackHandler !== 'function') {
				const error = new Error('Missing option: callbackHandler');
				this.sdk.logging?.error('Required option missing', error);
				throw error;
			}
			if (!uri.toString().startsWith(this.sdk.options.redirectUri)) {
				const error = new Error('Invalid redirect URI');
				this.sdk.logging?.error('Invalid redirect URI', error);
				throw error;
			}

			return await this.sdk.tokenExchange(
				(await this.sdk.options.callbackHandler(uri.toString(), this.sdk.options.responseMode || 'fragment')) as Record<string, string>,
			);
		}

		if (uri.searchParams.has('error')) {
			const error = new Error(`${uri.searchParams.get('error')}: ${uri.searchParams.get('error_description')}`);
			this.sdk.logging?.error('Authorization error', error);
			throw error;
		}

		if (!uri.searchParams.has('session_id')) {
			const error = new Error('"session_id" is missing from the response');
			this.sdk.logging?.error('Failed to start a session', error);
			throw error;
		}

		this.sessionId = uri.searchParams.get('session_id');

		return this.submitForm();
	}

	/**
	 * Finalizes the session using the provided [finalizeUrl].
	 *
	 * @param {string} finalizeUrl The URL to finalize the session.
	 *
	 * @throws {Error} Throws an error if callback handler is not defined or redirect URI is invalid.
	 */
	async finalizeSession(finalizeUrl: URL | string): Promise<void> {
		this.sdk.logging?.debug('Finalizing login flow session');

		const response = await this.sdk.httpClient.request(finalizeUrl.toString(), {
			method: 'GET',
			headers: { Authorization: `Bearer ${this.sessionId}` },
			credentials: 'include',
		});
		const redirectUri = new URL(await response.text());

		if (typeof this.sdk.options.callbackHandler !== 'function') {
			const error = new Error('Missing option: callbackHandler');
			this.sdk.logging?.error('Required option missing', error);
			throw error;
		}

		if (!redirectUri.toString().startsWith(this.sdk.options.redirectUri)) {
			const error = new Error('Invalid redirect URI');
			this.sdk.logging?.error('Finalize session error', error);
			throw error;
		}

		await this.sdk.tokenExchange(
			(await this.sdk.options.callbackHandler(redirectUri.toString(), this.sdk.options.responseMode || 'fragment')) as Record<string, string>,
		);
	}

	/**
	 * Submits a form with the provided [formId] and [data].
	 *
	 * @returns {Promise<LoginFlowState>}
	 *
	 * @throws {Error} Throws an error if form submission fails.
	 * @throws {FallbackError} Throws a fallback error if response indicates fallback is needed.
	 */
	async submitForm(formId?: string, body: Record<string, unknown> = {}): Promise<LoginFlowState> {
		if (formId) {
			this.sdk.logging?.debug(`Submitting form: ${formId}`);
		}

		const response = await this.sdk.httpClient.request<LoginFlowState>(
			new URL(`/flow/api/v1/${formId ? `form/${formId}` : 'init'}`, this.sdk.options.issuer).toString(),
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${this.sessionId}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				credentials: 'include',
			},
		);
		const data = await response.json();

		if (!response.ok) {
			if (response.status >= 400 && response.status < 500) {
				if (response.status !== 403 && data?.hostedUrl && !data.messages) {
					this.sdk.logging?.warn(`Triggering fallback due to: Received HTTP ${response.status} without messages`);
					throw new FallbackError(new URL(data.hostedUrl));
				}

				if (response.status !== 400) {
					const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
					this.sdk.logging?.error(`Form submission error`, error);
					throw error;
				}
			}
		}

		if (data.finalizeUrl) {
			await this.finalizeSession(data.finalizeUrl);
		} else if (data.hostedUrl && !data.forms && !data.messages) {
			this.sdk.logging?.warn(`Triggering fallback due to: No forms or messages in response`);
			throw new FallbackError(new URL(data.hostedUrl));
		} else if (data.screen) {
			this.sdk.logging?.info(`Rendering screen: ${data.screen}`);
		}

		return data;
	}
}
