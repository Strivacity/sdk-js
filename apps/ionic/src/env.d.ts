/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

import type { RedirectFlow } from '@strivacity/sdk-capacitor/flows/RedirectFlow';
import type { NativeFlow } from '@strivacity/sdk-capacitor/flows/NativeFlow';

/* eslint-disable no-var */
declare global {
	var sdk: RedirectFlow | NativeFlow;
}
/* eslint-enable no-var */
