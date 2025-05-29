import type { SDKOptions, ExtraRequestArgs } from '@strivacity/sdk-core';
import { NativeFlowHandler } from '@strivacity/sdk-core/utils/NativeFlowHandler';
import { BaseFlow } from '@strivacity/sdk-core/flows/BaseFlow';

export class NativeFlow extends BaseFlow<SDKOptions, ExtraRequestArgs> {
	/**
	 * Initiates the login process via native UI.
	 * @param {ExtraRequestArgs} [params={}] Optional parameters for native configuration.
	 * @returns {NativeFlowHandler} Returns with a native login handler.
	 */
	login(params: ExtraRequestArgs = {}): NativeFlowHandler {
		this.dispatchEvent('loginInitiated', []);

		return new NativeFlowHandler(this, params);
	}

	/**
	 * Initiates the registration process via native UI.
	 * @param {ExtraRequestArgs} [params={}] Optional parameters for native configuration.
	 * @returns {NativeFlowHandler} Returns with a native login handler.
	 */
	register(params: ExtraRequestArgs = {}): NativeFlowHandler {
		params.prompt = 'create';

		return this.login(params);
	}

	/**
	 * It's just a placeholder for the URL handler.
	 * The native flow does not require a URL handler.
	 */
	async urlHandler(): Promise<void> {
		// Nothing to do
	}
}
