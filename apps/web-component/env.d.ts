/// <reference types="vite/client" />

import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';

/* eslint-disable no-var */
declare global {
	var sdk: PopupFlow | RedirectFlow;
}
/* eslint-enable no-var */
