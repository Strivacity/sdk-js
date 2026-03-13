import type { SDKOptions } from './types';
import { BaseFlow } from './flows/BaseFlow';
import { RedirectFlow } from './flows/RedirectFlow';
import { PopupFlow } from './flows/PopupFlow';
import { NativeFlow } from './flows/NativeFlow';
import { EmbeddedFlow } from './flows/EmbeddedFlow';
import { LocalStorage } from './storages/LocalStorage';
import { HttpClient } from './utils/HttpClient';

export * from './utils/errors';
export type * from './types';
export { SDKStorage, SDKLogging, SDKHttpClient } from './types';

/**
 * Initializes an authentication flow based on the specified mode.
 *
 * @param {SDKOptions & { mode?: 'popup' | 'redirect' | 'native' | 'embedded' }} options - The SDK options, including an optional mode. The default storage class is `LocalStorage`.
 * @returns {PopupFlow | RedirectFlow | NativeFlow | EmbeddedFlow} A new instance of either PopupFlow, RedirectFlow, NativeFlow or EmbeddedFlow based on the mode.
 */
export function initFlow(options: SDKOptions & { mode: 'popup' }): PopupFlow;
export function initFlow(options: SDKOptions & { mode: 'redirect' }): RedirectFlow;
export function initFlow(options: SDKOptions & { mode: 'native' }): NativeFlow;
export function initFlow(options: SDKOptions & { mode: 'embedded' }): EmbeddedFlow;
export function initFlow(options: SDKOptions & { mode: 'custom' }): EmbeddedFlow;
export function initFlow(
	options: SDKOptions & { mode?: 'popup' | 'redirect' | 'native' | 'embedded' | 'custom' },
): PopupFlow | RedirectFlow | NativeFlow | EmbeddedFlow | typeof options.customFlow;
export function initFlow(
	options: SDKOptions & { mode?: 'popup' | 'redirect' | 'native' | 'embedded' | 'custom' },
): PopupFlow | RedirectFlow | NativeFlow | EmbeddedFlow | typeof options.customFlow {
	const StorageClass = options.storage || LocalStorage;
	const HttpClientClass = options.httpClient || HttpClient;

	const storage = new StorageClass();
	const httpClient = new HttpClientClass();
	let logging;

	if (options.logging) {
		logging = new options.logging();
		httpClient.logging = logging;
	}

	if (options.mode === 'popup') {
		return new PopupFlow(options, storage, httpClient, logging);
	} else if (options.mode === 'native') {
		return new NativeFlow(options, storage, httpClient, logging);
	} else if (options.mode === 'embedded') {
		return new EmbeddedFlow(options, storage, httpClient, logging);
	} else if (options.mode === 'custom') {
		if (!options.customFlow || !(options.customFlow.prototype instanceof BaseFlow)) {
			throw new Error('customFlow must extend BaseFlow');
		}

		return new options.customFlow(options, storage, httpClient, logging) as unknown as typeof options.customFlow;
	} else {
		return new RedirectFlow(options, storage, httpClient, logging);
	}
}
