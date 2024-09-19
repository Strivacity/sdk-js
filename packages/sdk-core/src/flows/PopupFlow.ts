import type { SDKOptions, PopupWindowParams } from '../types';
import { popupCallbackHandler, popupUrlHandler } from '../utils/handlers';
import { isBrowser } from '../utils/constants';
import { State } from '../State';
import { BaseFlow } from './BaseFlow';

/**
 * Implements the Popup flow for authentication using a popup window.
 */
export class PopupFlow extends BaseFlow<SDKOptions, PopupWindowParams> {
	/**
	 * Initiates the login process via a popup window.
	 * @param {PopupWindowParams} [options={}] Optional parameters for popup window configuration.
	 * @returns {Promise<void>} A promise that resolves when the login process completes.
	 */
	async login(options: PopupWindowParams = {}): Promise<void> {
		if (!isBrowser) {
			return;
		}

		const state = await State.create();
		const url = await this.getAuthorizationUrl(options);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);
		url.searchParams.append('display', 'popup');

		this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);

		const data = await this.urlHandler(url, options);

		await this.exchangeCodeForTokens(data);

		if (this.accessToken && this.idTokenClaims) {
			this.dispatchEvent('loggedIn', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
		}
	}

	/**
	 * Initiates the registration process via a popup window.
	 * @param {PopupWindowParams} [options={}] Optional parameters for popup window configuration.
	 * @returns {Promise<void>} A promise that resolves when the registration process completes.
	 */
	async register(options: PopupWindowParams = {}): Promise<void> {
		if (!isBrowser) {
			return;
		}

		options.prompt = 'create';

		await this.login(options);
	}

	/**
	 * Handles the callback after login or registration via a popup window.
	 * @returns {Promise<void>} A promise that resolves when the callback is handled.
	 */
	async handleCallback(): Promise<void> {
		popupCallbackHandler(this.options.responseMode || 'fragment');
	}

	/**
	 * Handles the URL redirection to a popup window.
	 * @param {URL} url The URL to handle.
	 * @param {PopupWindowParams} [options] Optional parameters for popup window configuration.
	 * @returns {Promise<Record<string, string>>} A promise that resolves to the data returned from the popup window.
	 */
	async urlHandler(url: URL, options?: PopupWindowParams): Promise<Record<string, string>> {
		return popupUrlHandler(url, options);
	}
}
