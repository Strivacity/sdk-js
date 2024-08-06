import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mocks } from '@strivacity/vitest/msw';
import openidConfiguration from '@strivacity/vitest/fixtures/openid-configuration.json';
import { Metadata } from '../src/Metadata';

describe('Metadata', () => {
	const metadata = new Metadata('https://brandtegrity.io/.well-known/openid-configuration');
	const fetchMetadataSpy = vi.spyOn(metadata, 'fetchMetadata');

	beforeEach(() => {
		mocks.wellKnown();
	});

	afterEach(() => {
		fetchMetadataSpy.mockReset();
	});

	describe('getMetadataProperty', () => {
		it('should fetch once', async () => {
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
