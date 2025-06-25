/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';

declare global {
	var sdk: PopupFlow | RedirectFlow;
}
