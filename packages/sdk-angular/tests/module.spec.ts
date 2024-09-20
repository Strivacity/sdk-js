import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { type SDKOptions, STRIVACITY_SDK, StrivacityAuthModule } from '../src/public-api';

const options: SDKOptions = {
	issuer: 'https://brandtegrity.io',
	scopes: ['openid', 'profile'],
	clientId: '2202c596c06e4774b42804af00c66df9',
	redirectUri: 'https://brandtegrity.io/app/callback/',
	responseType: 'code',
	responseMode: 'query',
};

describe('StrivacityAuthModule', () => {
	describe('forRoot', () => {
		it('should provide the SDKOptions correctly', () => {
			TestBed.configureTestingModule({
				schemas: [CUSTOM_ELEMENTS_SCHEMA],
				imports: [StrivacityAuthModule.forRoot(options)],
			});

			const module = TestBed.inject(StrivacityAuthModule);
			expect(module).toBeTruthy();

			const providedOptions = TestBed.inject(STRIVACITY_SDK);
			expect(providedOptions).toBe(options);
		});
	});
});
