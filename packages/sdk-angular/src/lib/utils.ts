import type { Provider, ModuleWithProviders } from '@angular/core';
import type { AngularSDKInitConfig } from '../types';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule, InjectionToken } from '@angular/core';
import { StrivacityAuthService } from './services/auth.service';

export const STRIVACITY_SDK = new InjectionToken<AngularSDKInitConfig>('strivacity-sdk');

/**
 * Provides the Strivacity SDK configuration and the `StrivacityAuthService` as dependency injection providers.
 *
 * This function is used to supply the Strivacity SDK configuration to the application
 * by binding it to the `STRIVACITY_SDK` token, and to register `StrivacityAuthService` as an injectable.
 *
 * @param {AngularSDKInitConfig} config The SDK configuration options.
 * @returns {Provider[]} The providers to add to the application (or component) injector.
 */
export function provideStrivacity(config: AngularSDKInitConfig): Provider[] {
	return [{ provide: STRIVACITY_SDK, useValue: config }, StrivacityAuthService];
}

@NgModule({
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class StrivacityAuthModule {
	/**
	 * Registers the Strivacity SDK configuration and the `StrivacityAuthService` as dependency injection providers.
	 *
	 * This is the `NgModule`-based equivalent of `provideStrivacity()`, for applications that still bootstrap via `NgModule`.
	 *
	 * @param {AngularSDKInitConfig} options The SDK configuration options.
	 * @returns {ModuleWithProviders<StrivacityAuthModule>} The module along with its providers, to be imported once at the root of the application.
	 */
	static forRoot(options: AngularSDKInitConfig): ModuleWithProviders<StrivacityAuthModule> {
		return {
			ngModule: StrivacityAuthModule,
			providers: [provideStrivacity(options)],
		};
	}
}
