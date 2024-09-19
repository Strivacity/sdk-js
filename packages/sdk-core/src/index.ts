import type { SDKOptions } from './types';
import { RedirectFlow } from './flows/RedirectFlow';
import { PopupFlow } from './flows/PopupFlow';
import { LocalStorage } from './storages/LocalStorage';

export type * from './types';

/**
 * Initializes an authentication flow based on the specified mode.
 *
 * @param {SDKOptions & { mode?: 'popup' | 'redirect' }} options - The SDK options, including an optional mode. The default storage class is `LocalStorage`.
 * @returns {PopupFlow | RedirectFlow} A new instance of either PopupFlow or RedirectFlow based on the mode.
 */
export function initFlow(options: SDKOptions & { mode: 'popup' }): PopupFlow;
export function initFlow(options: SDKOptions & { mode: 'redirect' }): RedirectFlow;
export function initFlow(options: SDKOptions & { mode?: 'popup' | 'redirect' }): PopupFlow | RedirectFlow;
export function initFlow(options: SDKOptions & { mode?: 'popup' | 'redirect' }): PopupFlow | RedirectFlow {
	const StorageClass = options.storage || LocalStorage;

	if (options.mode === 'popup') {
		return new PopupFlow(options, new StorageClass());
	} else {
		return new RedirectFlow(options, new StorageClass());
	}
}
