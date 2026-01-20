import type { SDKOptions, PopupParams, SDKStorage, SDKHttpClient, SDKLogging } from '../types';
import { popupCallbackHandler, popupUrlHandler } from '../utils/handlers';
import { State } from '../utils/State';
import { BaseFlow } from './BaseFlow';

/**
 * Implements the Popup flow for authentication using a popup window.
 */
export class PopupFlow extends BaseFlow<SDKOptions, PopupParams> {
	constructor(options: SDKOptions, storage: SDKStorage, httpClient: SDKHttpClient, logging?: SDKLogging) {
		if (!options.urlHandler) {
			options.urlHandler = popupUrlHandler;
		}
		if (!options.callbackHandler) {
			options.callbackHandler = popupCallbackHandler;
		}

		super(options, storage, httpClient, logging);
	}

	/**
	 * Initiates the login process via a popup window.
	 * @param {PopupParams} [params={}] Optional parameters for popup window configuration.
	 * @returns {Promise<void>} A promise that resolves when the login process completes.
	 *
	 * @throws {Error} Throws an error if URL handler is not defined.
	 */
	async login(params: PopupParams = {}): Promise<void> {
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
		url.searchParams.append('display', 'popup');

		await this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);
		this.logging?.debug('Attempting to redirect for login');

		const data = (await this.options.urlHandler(url.toString(), params)) as Record<string, string>;

		await this.tokenExchange(data);
	}

	/**
	 * Initiates the registration process via a popup window.
	 * @param {PopupParams} [params={}] Optional parameters for popup window configuration.
	 * @returns {Promise<void>} A promise that resolves when the registration process completes.
	 */
	async register(params: PopupParams = {}): Promise<void> {
		params.prompt = 'create';

		await this.login(params);
	}

	/**
	 * Initiates the entry process via a popup window.
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
	 * Handles the callback after login or registration via a popup window.
	 *
	 * @throws {Error} Throws an error if callback handler is not defined.
	 */
	async handleCallback(): Promise<void> {
		if (typeof this.options.callbackHandler !== 'function') {
			const error = new Error('Missing option: callbackHandler');
			this.logging?.error('Required option missing', error);
			throw error;
		}

		await this.options.callbackHandler(this.options.responseMode || 'fragment');
	}
}
