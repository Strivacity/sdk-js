import type { SDKOptions } from '@strivacity/sdk-core';
import type { CapacitorParams } from '../types';
import { Capacitor } from '@capacitor/core';
import { State } from '@strivacity/sdk-core/utils/State';
import { BaseFlow } from '@strivacity/sdk-core/flows/BaseFlow';
import { urlHandler, callbackHandler } from '../utils/handlers';

/**
 * Implements the Redirect flow for authentication using a full-page redirect.
 */
export class RedirectFlow extends BaseFlow<SDKOptions, CapacitorParams> {
	/**
	 * Initiates the login process via a redirect.
	 * @param {CapacitorParams} [params={}] Optional parameters for redirect configuration.
	 * @returns {Promise<void>} A promise that resolves when the login process completes.
	 */
	async login(params: CapacitorParams = {}): Promise<void> {
		const state = await State.create();
		const url = await this.getAuthorizationUrl(params);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);

		await this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);

		await this.urlHandler(url, params);

		if (Capacitor.getPlatform() !== 'web') {
			const queryParams = await callbackHandler(this.options.redirectUri, this.options.responseMode || 'fragment');

			console.log('RedirectFlow: queryParams', queryParams);

			await this.tokenExchange(queryParams);
		}
	}

	/**
	 * Initiates the registration process via a redirect.
	 * @param {CapacitorParams} [params={}] Optional parameters for redirect configuration.
	 * @returns {Promise<void>} A promise that resolves when the registration process completes.
	 */
	async register(params: CapacitorParams = {}): Promise<void> {
		params.prompt = 'create';

		await this.login(params);
	}

	/**
	 * Handles the callback after login or registration via a redirect.
	 * @param {string} [url] The URL to handle the callback from. Defaults to the current window location.
	 * @returns {Promise<void>} A promise that resolves when the callback is handled.
	 */
	async handleCallback(url?: string): Promise<void> {
		if (Capacitor.getPlatform() === 'web') {
			if (!url) {
				url = globalThis.window?.location.href;
			}

			const data = new URL(url)[this.options.responseMode === 'query' ? 'search' : 'hash'].slice(1);

			await this.tokenExchange(Object.fromEntries(new URLSearchParams(data)));
		}
	}

	/**
	 * Handles the URL redirection to the specified target.
	 * @param {URL} url The URL to handle.
	 * @param {CapacitorParams} [params] Optional parameters for redirection.
	 * @returns {Promise<void>} A promise that resolves when the redirection is handled.
	 */
	async urlHandler(url: URL, params?: CapacitorParams): Promise<void> {
		return urlHandler(url, params);
	}
}
