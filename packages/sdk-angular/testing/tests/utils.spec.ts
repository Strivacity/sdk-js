import type { AngularSDKInitConfig } from '../../src/types';
import { describe, test, expect } from 'vitest';
import { StrivacityAuthService } from '../../src/lib/services/auth.service';
import { STRIVACITY_SDK, provideStrivacity, StrivacityAuthModule } from '../../src/lib/utils';
import { createOptions } from '@strivacity/testing/mocks/sdk';

describe('provideStrivacity', () => {
	test('provides the config under STRIVACITY_SDK and registers StrivacityAuthService', () => {
		const config = createOptions() as AngularSDKInitConfig;

		expect(provideStrivacity(config)).toEqual([{ provide: STRIVACITY_SDK, useValue: config }, StrivacityAuthService]);
	});
});

describe('StrivacityAuthModule', () => {
	test('forRoot wraps provideStrivacity into a ModuleWithProviders', () => {
		const config = createOptions() as AngularSDKInitConfig;

		expect(StrivacityAuthModule.forRoot(config)).toEqual({
			ngModule: StrivacityAuthModule,
			providers: [[{ provide: STRIVACITY_SDK, useValue: config }, StrivacityAuthService]],
		});
	});
});
