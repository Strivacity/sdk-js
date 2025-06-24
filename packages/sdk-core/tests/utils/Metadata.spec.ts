import { vi, describe, test, expect } from 'vitest';
import openidConfiguration from '@strivacity/testing/fixtures/openid-configuration.json';
import type { SDKOptions } from '../../src/types';
import { Metadata } from '../../src/utils/Metadata';
import { initFlow } from '../../src';

describe('Metadata', () => {
	const options: SDKOptions = {
		mode: 'redirect',
		issuer: 'https://brandtegrity.io',
		scopes: ['openid', 'profile'],
		clientId: '2202c596c06e4774b42804af00c66df9',
		redirectUri: 'https://brandtegrity.io/app/callback/',
		responseType: 'code',
		responseMode: 'query',
	};
	const flow = initFlow(options);

	describe('getMetadataProperty', () => {
		test('should fetch once', async () => {
			const metadata = new Metadata(flow, 'https://brandtegrity.io/.well-known/openid-configuration');
			const fetchMetadataSpy = vi.spyOn(metadata, 'fetchMetadata');

			expect(await metadata.issuer).toEqual(openidConfiguration.issuer);
			expect(await metadata.authorizationEndpoint).toEqual(openidConfiguration.authorization_endpoint);
			expect(await metadata.userinfoEndpoint).toEqual(openidConfiguration.userinfo_endpoint);
			expect(await metadata.endSessionEndpoint).toEqual(openidConfiguration.end_session_endpoint);
			expect(await metadata.revocationEndpoint).toEqual(openidConfiguration.revocation_endpoint);
			expect(await metadata.jwksUri).toEqual(openidConfiguration.jwks_uri);
			expect(fetchMetadataSpy).toHaveBeenCalledOnce();
		});
	});
});
