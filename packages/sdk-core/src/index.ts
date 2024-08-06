import type { SDKOptions } from './types';
import { RedirectFlow } from './flows/RedirectFlow';
import { PopupFlow } from './flows/PopupFlow';
import { LocalStorage } from './storages/LocalStorage';

export type * from './types';

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
