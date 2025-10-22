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
	 */
	async startSession(sessionId?: string | null): Promise<LoginFlowState | void> {
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
		const redirectUri = new URL(await response.text());

		if (redirectUri.searchParams.has('code')) {
			if (typeof this.sdk.options.callbackHandler !== 'function') {
				throw new Error('Callback handler is not defined. Please provide a valid callback handler function in the SDK options.');
			}
			if (!redirectUri.toString().startsWith(this.sdk.options.redirectUri)) {
				throw new Error('Invalid redirect URI');
			}

			return await this.sdk.tokenExchange(
				(await this.sdk.options.callbackHandler(redirectUri.toString(), this.sdk.options.responseMode || 'fragment')) as Record<string, string>,
			);
		}

		if (redirectUri.searchParams.has('error')) {
			throw new Error(`${redirectUri.searchParams.get('error')}: ${redirectUri.searchParams.get('error_description')}`);
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
		const response = await this.sdk.httpClient.request(finalizeUrl, { method: 'GET', credentials: 'include' });
		const redirectUri = new URL(await response.text());

		if (typeof this.sdk.options.callbackHandler !== 'function') {
			throw new Error('Callback handler is not defined. Please provide a valid callback handler function in the SDK options.');
		}

		if (!redirectUri.toString().startsWith(this.sdk.options.redirectUri)) {
			throw new Error('Invalid redirect URI');
		}

		await this.sdk.tokenExchange(
			(await this.sdk.options.callbackHandler(redirectUri.toString(), this.sdk.options.responseMode || 'fragment')) as Record<string, string>,
		);
	}

	/**
	 * Submits a form with the provided [formId] and [data].
	 *
	 * @returns {Promise<LoginFlowState>}
	 */
	async submitForm(formId?: string, body: Record<string, unknown> = {}): Promise<LoginFlowState> {
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
					throw new FallbackError(new URL(data.hostedUrl));
				}

				if (response.status !== 400) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}
			}
		}

		if (data.finalizeUrl) {
			await this.finalizeSession(data.finalizeUrl);
		} else if (data.hostedUrl && !data.forms && !data.messages) {
			throw new FallbackError(new URL(data.hostedUrl));
		}

		return data;
	}
}
