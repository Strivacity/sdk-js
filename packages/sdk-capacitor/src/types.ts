import type { WebViewOptions } from '@capacitor/inappbrowser';
import type { ExtraRequestArgs } from '@strivacity/sdk-core';

export type CapacitorParams = ExtraRequestArgs & Partial<WebViewOptions>;
