import type { SDKInitConfig, NativeLoginControllerOptions } from '@strivacity/sdk-core/types';
import type { initFlow } from '@strivacity/sdk-core';

export * from '@strivacity/sdk-core/types';

/**
 * Configuration used to initialize the Strivacity SDK on the client (browser) side.
 */
export type AngularSDKInitConfig = SDKInitConfig;

/**
 * The concrete SDK flow instance returned by `initFlow`, matching the configured `mode`.
 */
export type SDKInstance = ReturnType<typeof initFlow>;

/**
 * Callbacks and parameters of the native login flow. See `NativeLoginControllerOptions` in `@strivacity/sdk-core`.
 */
export type NativeLoginOptions = NativeLoginControllerOptions;
