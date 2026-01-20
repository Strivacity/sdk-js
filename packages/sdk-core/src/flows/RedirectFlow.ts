import type { SDKOptions, RedirectParams, SDKStorage, SDKHttpClient, SDKLogging } from '../types';
import { redirectUrlHandler, redirectCallbackHandler } from '../utils/handlers';
import { State } from '../utils/State';
import { BaseFlow } from './BaseFlow';

/**
 * Implements the Redirect flow for authentication using a full-page redirect.
 */
export class RedirectFlow extends BaseFlow<SDKOptions, RedirectParams> {
	constructor(options: SDKOptions, storage: SDKStorage, httpClient: SDKHttpClient, logging?: SDKLogging) {
		if (!options.urlHandler) {
			options.urlHandler = redirectUrlHandler;
		}
		if (!options.callbackHandler) {
			options.callbackHandler = redirectCallbackHandler;
		}

		super(options, storage, httpClient, logging);
	}

	/**
	 * Initiates the login process via a redirect.
	 * @param {RedirectParams} [params={}] Optional parameters for redirect configuration.
	 * @returns {Promise<void>} A promise that resolves when the login process completes.
	 *
	 * @throws {Error} Throws an error if URL handler is not defined.
	 */
	async login(params: RedirectParams = {}): Promise<void> {
		if (typeof this.options.urlHandler !== 'function') {
			const error = new Error('Missing option: urlHandler');
			this.logging?.error('Required option missing', error);
			throw error;
		}

		const state = await State.create();
		const url = await this.getAuthorizationUrl(params);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);

		await this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);
		this.logging?.debug('Attempting to redirect for login');

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
	 *
	 * @throws {Error} Throws an error if URL handler is not defined.
	 */
	async entry(url?: string): Promise<void> {
		if (typeof this.options.urlHandler !== 'function') {
			const error = new Error('Missing option: urlHandler');
			this.logging?.error('Required option missing', error);
			throw error;
		}

		if (!url) {
			url = globalThis.window?.location.href;
		}

		const entryUrl = new URL(url);

		this.logging?.debug('Attempting to redirect for entry');

		await this.options.urlHandler(`${this.options.issuer}/provider/entry?${entryUrl.searchParams.toString()}`);
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
