import type { SDKOptions } from './types';
import { RedirectFlow } from './flows/RedirectFlow';
import { PopupFlow } from './flows/PopupFlow';
import { NativeFlow } from './flows/NativeFlow';
import { LocalStorage } from './storages/LocalStorage';

export { SDKStorage } from './types';
export * from './utils/errors';
export type * from './types';

/**
 * Initializes an authentication flow based on the specified mode.
 *
 * @param {SDKOptions & { mode?: 'popup' | 'redirect' | 'native' }} options - The SDK options, including an optional mode. The default storage class is `LocalStorage`.
 * @returns {PopupFlow | RedirectFlow | NativeFlow} A new instance of either PopupFlow, RedirectFlow, or NativeFlow based on the mode.
 */
export function initFlow(options: SDKOptions & { mode: 'popup' }): PopupFlow;
export function initFlow(options: SDKOptions & { mode: 'redirect' }): RedirectFlow;
export function initFlow(options: SDKOptions & { mode: 'native' }): NativeFlow;
export function initFlow(options: SDKOptions & { mode?: 'popup' | 'redirect' | 'native' }): PopupFlow | RedirectFlow | NativeFlow;
export function initFlow(options: SDKOptions & { mode?: 'popup' | 'redirect' | 'native' }): PopupFlow | RedirectFlow | NativeFlow {
	const StorageClass = options.storage || LocalStorage;

	if (options.mode === 'popup') {
		return new PopupFlow(options, new StorageClass());
	} else if (options.mode === 'native') {
		return new NativeFlow(options, new StorageClass());
	} else {
		return new RedirectFlow(options, new StorageClass());
	}
}
