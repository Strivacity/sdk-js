import { InjectionToken } from '@angular/core';
import type { SDKOptions } from '@strivacity/sdk-core';

export const STRIVACITY_SDK = new InjectionToken<SDKOptions>('sty');

export function provideStrivacity(config: SDKOptions) {
	return { provide: STRIVACITY_SDK, useValue: config };
}
