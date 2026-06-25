import type { SDKInitConfig, RedirectFlow, PopupFlow, EmbeddedFlow, NativeFlow } from './types';
import { UnsupportedFlowError } from './utils/errors';
import { createRedirectFlow } from './flows/redirect';
import { createPopupFlow } from './flows/popup';
import { createEmbeddedFlow } from './flows/embedded';
import { createNativeFlow } from './flows/native';

export * from './utils/errors';
export type * from './types';

/**
 * Initializes an authentication flow based on the specified mode.
 *
 * @param {SDKInitConfig & { mode?: 'popup' | 'redirect' | 'embedded' | 'native' }} options - The configuration options for the SDK.
 * @returns {PopupFlow | RedirectFlow | EmbeddedFlow | NativeFlow} An instance of the corresponding flow class based on the specified mode.
 */
export async function initFlow(options: SDKInitConfig & { mode: 'popup' }): Promise<PopupFlow>;
export async function initFlow(options: SDKInitConfig & { mode: 'redirect' }): Promise<RedirectFlow>;
export async function initFlow(options: SDKInitConfig & { mode: 'embedded' }): Promise<EmbeddedFlow>;
export async function initFlow(options: SDKInitConfig & { mode: 'native' }): Promise<NativeFlow>;
export async function initFlow(
	options: SDKInitConfig & { mode?: 'popup' | 'redirect' | 'embedded' | 'native' },
): Promise<PopupFlow | RedirectFlow | EmbeddedFlow | NativeFlow> {
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
