/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { NativeFlow } from 'packages/sdk-core/dist/flows/NativeFlow';
import type { EmbeddedFlow } from 'packages/sdk-core/dist/flows/EmbeddedFlow';

declare global {
	var sdk: PopupFlow | RedirectFlow | NativeFlow | EmbeddedFlow;
}
