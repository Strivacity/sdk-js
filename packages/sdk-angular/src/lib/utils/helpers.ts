import { InjectionToken } from '@angular/core';
import type { SDKOptions } from '@strivacity/sdk-core';

export const STRIVACITY_SDK = new InjectionToken<SDKOptions>('sty');

/**
 * Provides the Strivacity SDK configuration as a dependency injection token.
 *
 * This function is used to supply the Strivacity SDK configuration to the application
 * by binding it to the `STRIVACITY_SDK` token.
 *
 * @param {SDKOptions} config The SDK configuration options.
 * @returns {{ provide: InjectionToken<SDKOptions>, useValue: SDKOptions }} An object that provides the SDK configuration using the `STRIVACITY_SDK` token.
 */
export function provideStrivacity(config: SDKOptions) {
	return { provide: STRIVACITY_SDK, useValue: config };
}
