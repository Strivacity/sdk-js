import type { SDKOptions, PopupParams } from '../types';
import { popupCallbackHandler, popupUrlHandler } from '../utils/handlers';
import { State } from '../utils/State';
import { BaseFlow } from './BaseFlow';

/**
 * Implements the Popup flow for authentication using a popup window.
 */
export class PopupFlow extends BaseFlow<SDKOptions, PopupParams> {
	/**
	 * Initiates the login process via a popup window.
	 * @param {PopupParams} [params={}] Optional parameters for popup window configuration.
	 * @returns {Promise<void>} A promise that resolves when the login process completes.
	 */
	async login(params: PopupParams = {}): Promise<void> {
		const state = await State.create();
		const url = await this.getAuthorizationUrl(params);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);
		url.searchParams.append('display', 'popup');

		await this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);

		const data = await this.urlHandler(url, params);

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
	 * Handles the callback after login or registration via a popup window.
	 */
	handleCallback(): void {
		popupCallbackHandler(this.options.responseMode || 'fragment');
	}

	/**
	 * Handles the URL redirection to a popup window.
	 * @param {URL} url The URL to handle.
	 * @param {PopupParams} [params] Optional parameters for popup window configuration.
	 * @returns {Promise<Record<string, string>>} A promise that resolves to the data returned from the popup window.
	 */
	async urlHandler(url: URL, params?: PopupParams): Promise<Record<string, string>> {
		return popupUrlHandler(url, params);
	}
}
