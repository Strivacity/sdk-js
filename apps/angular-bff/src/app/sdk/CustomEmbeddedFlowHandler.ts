import { EmbeddedFlowHandler } from '@strivacity/sdk-core/handlers/EmbeddedFlowHandler';
import { CustomNativeFlow } from './CustomNativeFlow';

export class CustomEmbeddedFlowHandler extends EmbeddedFlowHandler {
	declare sdk: CustomNativeFlow;

	override async startSession(): Promise<void> {
		if (this.sdk.logging) {
			this.sdk.logging.xEventId = undefined;
			this.sdk.logging.info('Starting login flow session');
		}

		const response = await this.sdk.httpClient.request<Record<string, string>>(new URL('/api/session/start', location.origin).toString(), {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(this.params),
		});

		if (!response.ok) {
			const error = new Error(`Authorization request failed with status ${response.status}`);
			this.sdk.logging?.error('Authorization request error', error);
			throw error;
		}

		const data = await response.json();

		if (data.error) {
			const error = new Error(`${data.error}: ${data.error_description}`);
			this.sdk.logging?.error('Authorization error', error);
			throw error;
		}

		if (!data.short_app_id) {
			const error = new Error('"short_app_id" is missing from the response');
			this.sdk.logging?.error('Failed to start a session', error);
			throw error;
		}
		if (!data.session_id) {
			const error = new Error('"session_id" is missing from the response');
			this.sdk.logging?.error('Failed to start a session', error);
			throw error;
		}

		this.shortAppId = data.short_app_id;
		this.sessionId = data.session_id;
	}

	/**
	 * Finalizes the session using the provided [finalizeUrl].
	 *
	 * @param {string} finalizeUrl The URL to finalize the session.
	 *
	 * @throws {Error} Throws an error if callback handler is not defined or redirect URI is invalid.
	 */
	override async finalizeSession(finalizeUrl: URL | string): Promise<void> {
		this.sdk.logging?.debug('Finalizing login flow session');

		const finalizeResponse = await this.sdk.httpClient.request<string>(finalizeUrl.toString(), {
			method: 'GET',
			headers: { Authorization: `Bearer ${this.sessionId}` },
			credentials: 'include',
		});
		const redirectUri = new URL(await finalizeResponse.text());

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

		const response = await this.sdk.httpClient.request<Record<string, string>>(new URL('/api/session/finalize', location.origin).toString(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.sessionId}` },
			body: JSON.stringify(Object.fromEntries(redirectUri.searchParams)),
			credentials: 'include',
		});

		if (!response.ok) {
			const { error, error_description } = await response.json();
			const err = new Error(error, { cause: error_description });
			this.sdk.logging?.error('Failed to finalize session', err);
			throw err;
		}

		await this.sdk.fetchSessionData();
	}
}
