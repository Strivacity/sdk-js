import type { ExtraRequestArgs } from '../types';
import type { EmbeddedFlow } from '../flows/EmbeddedFlow';
import { State } from '../utils/State';

/**
 * Handler for the embedded login flow, managing the session and interactions with the SDK.
 */
export class EmbeddedFlowHandler {
	/**
	 * The short app ID associated with the session.
	 *
	 * @type {string | null}
	 */
	shortAppId: string | undefined;
	/**
	 * The session ID.
	 *
	 * @type {string | null}
	 */
	sessionId: string | undefined;

	constructor(
		/**
		 * The SDK instance.
		 *
		 * @type {EmbeddedFlow}
		 */
		protected sdk: EmbeddedFlow,
		/**
		 * Optional parameters for native configuration.
		 *
		 * @type {NativeParams} [options={}]
		 */
		protected params: ExtraRequestArgs = {},
	) {}

	/**
	 * Starts a new session.
	 *
	 * @param {string} [sessionId] - The session ID to start the session with. If not provided, a new session will be created.
	 * @returns {Promise<void>}
	 *
	 * @throws {Error} Throws an error if callback handler is not defined, redirect URI is invalid, authorization error occurs, or session ID is missing.
	 */
	async startSession(): Promise<void> {
		await this.sdk.waitToInitialize();

		if (this.sdk.logging) {
			this.sdk.logging.xEventId = undefined;
			this.sdk.logging.info('Starting login flow session');
		}

		const state = await State.create();
		const authorizationUrl = await this.sdk.getAuthorizationUrl(this.params);

		authorizationUrl.searchParams.append('sdk', 'web-embedded');
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

		this.shortAppId = uri.searchParams.get('short_app_id') || undefined;
		this.sessionId = uri.searchParams.get('session_id') || undefined;

		if (!this.shortAppId) {
			const error = new Error('"short_app_id" is missing from the response');
			this.sdk.logging?.error('Failed to start a session', error);
			throw error;
		}
		if (!this.sessionId) {
			const error = new Error('"session_id" is missing from the response');
			this.sdk.logging?.error('Failed to start a session', error);
			throw error;
		}
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
}
