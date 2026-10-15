import type { SDKInitConfig, SDKOptions, RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow } from './types';
import { UnsupportedFlowError } from './utils/errors';
import { createRedirectFlow } from './flows/redirect';
import { createPopupFlow } from './flows/popup';
import { createEmbeddedFlow } from './flows/embedded';
import { createNativeFlow } from './flows/native';

export type * from './types';

/**
 * Initializes an authentication flow based on the specified mode.
 *
 * @template T - The type of the flow instance returned by the factory function.
 * @param {SDKInitConfig} options - The configuration options for the SDK. `mode` is optional when `factory` is set (the factory receives `'redirect'` by default).
 * @returns T | PopupFlow | RedirectFlow | EmbeddedFlow | NativeFlow} - The initialized flow instance.
 * @throws {UnsupportedFlowError} If the specified mode is not supported.
 */
export function initFlow<T>(options: Omit<SDKInitConfig, 'mode' | 'factory'> & { mode?: SDKOptions['mode']; factory: (options: SDKInitConfig) => T }): T;
export function initFlow<T>(options: SDKInitConfig): T;
export function initFlow(options: SDKInitConfig & { mode: 'popup'; lazyLoad: true }): PopupFlow;
export function initFlow(options: SDKInitConfig & { mode: 'redirect'; lazyLoad: true }): RedirectFlow;
export function initFlow(options: SDKInitConfig & { mode: 'embedded'; lazyLoad: true }): EmbeddedFlow;
export function initFlow(options: SDKInitConfig & { mode: 'native'; lazyLoad: true }): NativeFlow;
export function initFlow(
	options: Omit<SDKInitConfig, 'mode'> & { mode?: SDKOptions['mode'] },
): Promise<PopupFlow | RedirectFlow | EmbeddedFlow | NativeFlow> | PopupFlow | RedirectFlow | EmbeddedFlow | NativeFlow | unknown {
	if (typeof options.factory === 'function') {
		return options.factory({ ...options, mode: options.mode ?? 'redirect' });
	}

	const config = options as SDKInitConfig;

	if (config.mode === 'redirect') {
		return createRedirectFlow(config);
	} else if (config.mode === 'popup') {
		return createPopupFlow(config);
	} else if (config.mode === 'embedded') {
		return createEmbeddedFlow(config);
	} else if (config.mode === 'native') {
		return createNativeFlow(config);
	}

	throw new UnsupportedFlowError();
}
