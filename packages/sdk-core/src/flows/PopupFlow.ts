import type { SDKOptions, PopupParams, SDKStorage, SDKHttpClient } from '../types';
import { popupCallbackHandler, popupUrlHandler } from '../utils/handlers';
import { State } from '../utils/State';
import { BaseFlow } from './BaseFlow';

/**
 * Implements the Popup flow for authentication using a popup window.
 */
export class PopupFlow extends BaseFlow<SDKOptions, PopupParams> {
	constructor(options: SDKOptions, storage: SDKStorage, httpClient: SDKHttpClient) {
		if (!options.urlHandler) {
			options.urlHandler = popupUrlHandler;
		}
		if (!options.callbackHandler) {
			options.callbackHandler = popupCallbackHandler;
		}

		super(options, storage, httpClient);
	}

	/**
	 * Initiates the login process via a popup window.
	 * @param {PopupParams} [params={}] Optional parameters for popup window configuration.
	 * @returns {Promise<void>} A promise that resolves when the login process completes.
	 */
	async login(params: PopupParams = {}): Promise<void> {
		if (typeof this.options.urlHandler !== 'function') {
			throw new Error('URL handler is not defined. Please provide a valid URL handler function in the SDK options.');
		}

		const state = await State.create();
		const url = await this.getAuthorizationUrl(params);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);
		url.searchParams.append('display', 'popup');

		await this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);

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
	 * Handles the callback after login or registration via a popup window.
	 */
	async handleCallback(): Promise<void> {
		if (typeof this.options.callbackHandler !== 'function') {
			throw new Error('Callback handler is not defined. Please provide a valid callback handler function in the SDK options.');
		}

		await this.options.callbackHandler(this.options.responseMode || 'fragment');
	}
}
