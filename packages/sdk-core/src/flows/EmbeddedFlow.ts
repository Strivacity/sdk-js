import type { SDKOptions, SDKStorage, SDKHttpClient, SDKLogging, ExtraRequestArgs } from '../types';
import { redirectUrlHandler, redirectCallbackHandler } from '../utils/handlers';
import { EmbeddedFlowHandler } from '../utils/EmbeddedFlowHandler';
import { BaseFlow } from './BaseFlow';

export class EmbeddedFlow extends BaseFlow<SDKOptions, ExtraRequestArgs> {
	constructor(options: SDKOptions, storage: SDKStorage, httpClient: SDKHttpClient, logging?: SDKLogging) {
		if (!options.urlHandler) {
			options.urlHandler = redirectUrlHandler;
		}
		if (!options.callbackHandler) {
			options.callbackHandler = redirectCallbackHandler;
		}

		super(options, storage, httpClient, logging);

		if (!globalThis.sty) {
			globalThis.sty = {};
		}

		// NOTE: Register the OIDC service instance globally for use in the login component
		globalThis.sty.oidcService = this;
	}

	/**
	 * Initiates the login process via embedded UI.
	 * @param {ExtraRequestArgs} [params={}] Optional parameters for the login request.
	 * @returns {EmbeddedFlowHandler} Returns with an embedded login handler.
	 */
	override login(params: ExtraRequestArgs = {}): EmbeddedFlowHandler {
		this.dispatchEvent('loginInitiated', []);

		return new EmbeddedFlowHandler(this, params);
	}

	override register(params: ExtraRequestArgs = {}) {
		params.prompt = 'create';

		return this.login(params);
	}

	override async entry(url?: string) {
		if (!url) {
			url = globalThis.window?.location.href;
		}

		const entryUrl = new URL(url);
		entryUrl.searchParams.append('sdk', 'web-embedded');
		entryUrl.searchParams.append('client_id', this.options.clientId);
		entryUrl.searchParams.append('redirect_uri', this.options.redirectUri);

		const response = await this.httpClient.request<string | Record<string, string>>(
			`${this.options.issuer}/provider/flow/entry?${entryUrl.searchParams.toString()}`,
		);

		if (!response.ok) {
			if (response.status === 400) {
				const data = await response.json();
				let message = 'Entry request failed with status 400';

				if (typeof data === 'object') {
					if (data.error) {
						message = `${data.error}: ${data.error_description}`;
					} else if (data.errorKey) {
						message = data.errorKey;
					}
				}

				const error = new Error(message);
				this.logging?.error('Entry request error', error);
				throw error;
			}

			const error = new Error(`Entry request failed with status ${response.status}`);
			this.logging?.error('Entry request error', error);
			throw error;
		}

		let uri: URL;

		try {
			uri = new URL(await response.text());
		} catch {
			uri = new URL(response.url);
		}

		const shortAppId = uri.searchParams.get('short_app_id');
		const sessionId = uri.searchParams.get('session_id');

		if (!shortAppId) {
			const error = new Error('"short_app_id" is missing from the response');
			this.logging?.error('Entry response error', error);
			throw error;
		}
		if (!sessionId) {
			const error = new Error('"session_id" is missing from the response');
			this.logging?.error('Entry response error', error);
			throw error;
		}

		return { session_id: sessionId, short_app_id: shortAppId };
	}

	/**
	 * Handles the callback after login or registration via a redirect.
	 * @param {string} [url] The URL to handle the callback from. Defaults to the current window location.
	 * @returns {Promise<void>} A promise that resolves when the callback is handled.
	 *
	 * @throws {Error} Throws an error if callback handler is not defined.
	 */
	async handleCallback(url?: string): Promise<void> {
		if (typeof this.options.callbackHandler !== 'function') {
			const error = new Error('Missing option: callbackHandler');
			this.logging?.error('Required option missing', error);
			throw error;
		}

		if (!url) {
			url = globalThis.window?.location.href;
		}

		await this.tokenExchange((await this.options.callbackHandler(url, this.options.responseMode || 'fragment')) as Record<string, string>);
	}
}
