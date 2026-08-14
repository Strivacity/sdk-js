import type { SDKInitConfig, LoginFlowMessage, NativeParams, SessionData } from '@strivacity/sdk-core/types';
import type { FallbackError, initFlow } from '@strivacity/sdk-core';

export * from '@strivacity/sdk-core/types';

/**
 * Configuration used to initialize the Strivacity SDK on the client (browser) side.
 */
export type AngularSDKInitConfig = SDKInitConfig;

/**
 * The concrete SDK flow instance returned by `initFlow`, matching the configured `mode`.
 */
export type SDKInstance = Awaited<ReturnType<typeof initFlow>>;

export type NativeLoginOptions = {
	/**
	 * Optional parameters to be passed to the login session request. These parameters will be sent to the `authorizationUri` endpoint.
	 */
	params?: NativeParams;

	/**
	 * Called when the user successfully completes the login flow.
	 */
	onLogin?: (session: SessionData) => void | Promise<void>;

	/**
	 * Called when the fallback flow is triggered, typically due to an error or unsupported environment.
	 */
	onFallback?: (error: FallbackError) => void | Promise<void>;

	/**
	 * Called when the login flow is closed by the user.
	 */
	onClose?: () => void | Promise<void>;

	/**
	 * Called when an error occurs during the login session initialization or flow.
	 */
	onError?: (error: Error) => void | Promise<void>;

	/**
	 * Called when a global message is received during the login flow.
	 */
	onGlobalMessage?: (message: LoginFlowMessage) => void | Promise<void>;
};
