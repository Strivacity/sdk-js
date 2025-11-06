import type { SDKOptions, NativeParams, SDKStorage, SDKHttpClient } from '../types';
import { redirectUrlHandler, redirectCallbackHandler } from '../utils/handlers';
import { NativeFlowHandler } from '../utils/NativeFlowHandler';
import { BaseFlow } from './BaseFlow';

export class NativeFlow extends BaseFlow<SDKOptions, NativeParams> {
	constructor(options: SDKOptions, storage: SDKStorage, httpClient: SDKHttpClient) {
		if (!options.urlHandler) {
			options.urlHandler = redirectUrlHandler;
		}
		if (!options.callbackHandler) {
			options.callbackHandler = redirectCallbackHandler;
		}

		super(options, storage, httpClient);
	}

	/**
	 * Initiates the login process via native UI.
	 * @param {NativeParams} [params={}] Optional parameters for native configuration.
	 * @returns {NativeFlowHandler} Returns with a native login handler.
	 */
	login(params: NativeParams = {}): NativeFlowHandler {
		this.dispatchEvent('loginInitiated', []);

		return new NativeFlowHandler(this, params);
	}

	/**
	 * Initiates the registration process via native UI.
	 * @param {NativeParams} [params={}] Optional parameters for native configuration.
	 * @returns {NativeFlowHandler} Returns with a native login handler.
	 */
	register(params: NativeParams = {}): NativeFlowHandler {
		params.prompt = 'create';

		return this.login(params);
	}

	/**
	 * Initiates the entry process via a redirect.
	 * @param {string} url Optional URL to use for the entry process. If not provided, the current window location will be used.
	 * @returns {Promise<string>} A promise that resolves to the session ID.
	 */
	async entry(url?: string): Promise<string> {
		if (!url) {
			url = globalThis.window?.location.href;
		}

		const entryUrl = new URL(url);
		entryUrl.searchParams.append('sdk', 'web');
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

				throw new Error(message);
			}

			throw new Error(`Entry request failed with status ${response.status}`);
		}

		const sessionId = new URL(await response.text()).searchParams.get('session_id');

		if (!sessionId) {
			throw new Error('Session ID not found in entry response');
		}

		return sessionId;
	}

	/**
	 * Handles the callback after login or registration via a redirect.
	 * @param {string} [url] The URL to handle the callback from. Defaults to the current window location.
	 * @returns {Promise<void>} A promise that resolves when the callback is handled.
	 */
	async handleCallback(url?: string): Promise<void> {
		if (typeof this.options.callbackHandler !== 'function') {
			throw new Error('Callback handler is not defined. Please provide a valid callback handler function in the SDK options.');
		}

		if (!url) {
			url = globalThis.window?.location.href;
		}

		await this.tokenExchange((await this.options.callbackHandler(url, this.options.responseMode || 'fragment')) as Record<string, string>);
	}
}
