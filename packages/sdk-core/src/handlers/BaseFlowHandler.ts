import type { NativeParams, LoginFlowState } from '../types';
import type { BaseFlow } from '../flows/BaseFlow';

export abstract class BaseFlowHandler {
	/**
	 * The session ID.
	 *
	 * @type {string | null}
	 */
	protected sessionId: string | null = null;

	/**
	 * The locale to use for the authentication flow.
	 *
	 * Defaults to the browser's language setting.
	 *
	 * @type {string}
	 */
	locale!: string;

	constructor(
		/**
		 * The SDK instance.
		 *
		 * @type {SDKStorage}
		 */
		protected sdk: BaseFlow,
		/**
		 * Optional parameters for native configuration.
		 *
		 * @type {NativeParams} [options={}]
		 */
		protected params: NativeParams = {},
	) {
		this.locale = params.uiLocales?.[0] || navigator.language;
	}

	/**
	 * Starts a new session.
	 *
	 * @param {string} [sessionId] - The session ID to start the session with. If not provided, a new session will be created.
	 * @returns {Promise<LoginFlowState | void>}
	 *
	 * @throws {Error} Throws an error if callback handler is not defined, redirect URI is invalid, authorization error occurs, or session ID is missing.
	 */
	abstract startSession(sessionId?: string | null): Promise<LoginFlowState | void>;

	/**
	 * Finalizes the session using the provided [finalizeUrl].
	 *
	 * @param {string} finalizeUrl The URL to finalize the session.
	 *
	 * @throws {Error} Throws an error if callback handler is not defined or redirect URI is invalid.
	 */
	abstract finalizeSession(finalizeUrl: URL | string): Promise<void>;
}
