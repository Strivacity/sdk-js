import type { SDKOptions, NativeParams } from '../types';
import { redirectUrlHandler, redirectCallbackHandler } from '../utils/handlers';
import { NativeFlowHandler } from '../utils/NativeFlowHandler';
import { BaseFlow } from './BaseFlow';

export class NativeFlow extends BaseFlow<SDKOptions, NativeParams> {
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
	 * Handles the callback after login or registration via a redirect.
	 * @param {string} [url] The URL to handle the callback from. Defaults to the current window location.
	 * @returns {Promise<void>} A promise that resolves when the callback is handled.
	 */
	async handleCallback(url?: string): Promise<void> {
		if (!url) {
			url = globalThis.window?.location.href;
		}

		await this.tokenExchange(redirectCallbackHandler(url, this.options.responseMode || 'fragment'));
	}

	/**
	 * Handles the URL redirection to the specified target.
	 * @param {URL} url The URL to handle.
	 * @param {NativeParams} [params] Optional parameters for redirection.
	 * @returns {Promise<void>} A promise that resolves when the redirection is handled.
	 */
	async urlHandler(url: URL, params?: NativeParams): Promise<void> {
		return redirectUrlHandler(url, params);
	}
}
