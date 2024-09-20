import type { SDKOptions, RedirectParams } from '../types';
import { redirectUrlHandler, redirectCallbackHandler } from '../utils/handlers';
import { isBrowser } from '../utils/constants';
import { State } from '../State';
import { BaseFlow } from './BaseFlow';

/**
 * Implements the Redirect flow for authentication using a full-page redirect.
 */
export class RedirectFlow extends BaseFlow<SDKOptions, RedirectParams> {
	/**
	 * Initiates the login process via a redirect.
	 * @param {RedirectParams} [options={}] Optional parameters for redirect configuration.
	 * @returns {Promise<void>} A promise that resolves when the login process completes.
	 */
	async login(options: RedirectParams = {}): Promise<void> {
		if (!isBrowser) {
			return;
		}

		const state = await State.create();
		const url = await this.getAuthorizationUrl(options);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);

		this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);

		await this.urlHandler(url, options);
	}

	/**
	 * Initiates the registration process via a redirect.
	 * @param {RedirectParams} [options={}] Optional parameters for redirect configuration.
	 * @returns {Promise<void>} A promise that resolves when the registration process completes.
	 */
	async register(options: RedirectParams = {}): Promise<void> {
		if (!isBrowser) {
			return;
		}

		options.prompt = 'create';

		await this.login(options);
	}

	/**
	 * Handles the callback after login or registration via a redirect.
	 * @param {string} [url] The URL to handle the callback from. Defaults to the current window location.
	 * @returns {Promise<void>} A promise that resolves when the callback is handled.
	 */
	async handleCallback(url?: string): Promise<void> {
		if (!url) {
			url = globalThis.window?.location.href;
		}

		await this.exchangeCodeForTokens(redirectCallbackHandler(url, this.options.responseMode || 'fragment'));

		if (this.accessToken && this.idTokenClaims) {
			this.dispatchEvent('loggedIn', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
		}
	}

	/**
	 * Handles the URL redirection to the specified target.
	 * @param {URL} url The URL to handle.
	 * @param {RedirectParams} [options] Optional parameters for redirection.
	 * @returns {Promise<void>} A promise that resolves when the redirection is handled.
	 */
	async urlHandler(url: URL, options?: RedirectParams): Promise<void> {
		return await redirectUrlHandler(url, options);
	}
}
