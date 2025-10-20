import type { SDKOptions, RedirectParams, SDKStorage, SDKHttpClient } from '../types';
import { redirectUrlHandler, redirectCallbackHandler } from '../utils/handlers';
import { State } from '../utils/State';
import { BaseFlow } from './BaseFlow';

/**
 * Implements the Redirect flow for authentication using a full-page redirect.
 */
export class RedirectFlow extends BaseFlow<SDKOptions, RedirectParams> {
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
	 * Initiates the login process via a redirect.
	 * @param {RedirectParams} [params={}] Optional parameters for redirect configuration.
	 * @returns {Promise<void>} A promise that resolves when the login process completes.
	 */
	async login(params: RedirectParams = {}): Promise<void> {
		if (typeof this.options.urlHandler !== 'function') {
			throw new Error('URL handler is not defined. Please provide a valid URL handler function in the SDK options.');
		}

		const state = await State.create();
		const url = await this.getAuthorizationUrl(params);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);

		await this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);

		await this.options.urlHandler(url.toString(), params);
	}

	/**
	 * Initiates the registration process via a redirect.
	 * @param {RedirectParams} [params={}] Optional parameters for redirect configuration.
	 * @returns {Promise<void>} A promise that resolves when the registration process completes.
	 */
	async register(params: RedirectParams = {}): Promise<void> {
		params.prompt = 'create';

		await this.login(params);
	}

	/**
	 * Initiates the entry process via a redirect.
	 * @param {string} url Optional URL to use for the entry process. If not provided, the current window location will be used.
	 * @returns {Promise<void>} A promise that resolves when the entry process completes.
	 */
	async entry(url?: string): Promise<void> {
		if (typeof this.options.urlHandler !== 'function') {
			throw new Error('URL handler is not defined. Please provide a valid URL handler function in the SDK options.');
		}

		if (!url) {
			url = globalThis.window?.location.href;
		}

		const entryUrl = new URL(url);

		await this.options.urlHandler(`${this.options.issuer}/provider/entry?${entryUrl.searchParams.toString()}`);
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
