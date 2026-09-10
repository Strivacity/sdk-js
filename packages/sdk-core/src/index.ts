import type { SDKInitConfig, RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow } from './types';
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
 * @param {SDKInitConfig & { mode?: 'popup' | 'redirect' | 'embedded' | 'native' }} options - The configuration options for the SDK.
 * @returns T | PopupFlow | RedirectFlow | EmbeddedFlow | NativeFlow} - The initialized flow instance.
 * @throws {UnsupportedFlowError} If the specified mode is not supported.
 */
export function initFlow<T>(options: SDKInitConfig): T;
export function initFlow(options: SDKInitConfig & { mode: 'popup'; lazyLoad: true }): PopupFlow;
export function initFlow(options: SDKInitConfig & { mode: 'redirect'; lazyLoad: true }): RedirectFlow;
export function initFlow(options: SDKInitConfig & { mode: 'embedded'; lazyLoad: true }): EmbeddedFlow;
export function initFlow(options: SDKInitConfig & { mode: 'native'; lazyLoad: true }): NativeFlow;
export function initFlow(
	options: SDKInitConfig & { mode?: 'popup' | 'redirect' | 'embedded' | 'native' },
): Promise<PopupFlow | RedirectFlow | EmbeddedFlow | NativeFlow> | PopupFlow | RedirectFlow | EmbeddedFlow | NativeFlow | unknown {
	if (typeof options.factory === 'function') {
		return options.factory(options);
	}

	if (options.mode === 'redirect') {
		return createRedirectFlow(options);
	} else if (options.mode === 'popup') {
		return createPopupFlow(options);
	} else if (options.mode === 'embedded') {
		return createEmbeddedFlow(options);
	} else if (options.mode === 'native') {
		return createNativeFlow(options);
	}

	throw new UnsupportedFlowError();
}
