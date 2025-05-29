import type { SDKOptions } from '@strivacity/sdk-core';
import { RedirectFlow } from './flows/RedirectFlow';
import { NativeFlow } from './flows/NativeFlow';
import { CapacitorStorage } from './storages/CapacitorStorage';

export * from '@strivacity/sdk-core/utils/errors';
export type * from '@strivacity/sdk-core';

/**
 * Initializes an authentication flow based on the specified mode.
 *
 * @param {SDKOptions & { mode?: 'redirect' | 'native' }} options - The SDK options, including an optional mode. The default storage class is `LocalStorage`.
 * @returns {RedirectFlow | NativeFlow} A new instance of either RedirectFlow, or NativeFlow based on the mode.
 */
export function initFlow(options: SDKOptions & { mode: 'redirect' }): RedirectFlow;
export function initFlow(options: SDKOptions & { mode: 'native' }): NativeFlow;
export function initFlow(options: SDKOptions & { mode?: 'redirect' | 'native' }): RedirectFlow | NativeFlow;
export function initFlow(options: SDKOptions & { mode?: 'redirect' | 'native' }): RedirectFlow | NativeFlow {
	const StorageClass = options.storage || CapacitorStorage;

	if (options.mode === 'native') {
		return new NativeFlow(options, new StorageClass());
	} else {
		return new RedirectFlow(options, new StorageClass());
	}
}
