import { test, expect } from 'vitest';
import * as index from '../../../src/server';

test('should export the correct things', () => {
	const expectedExports = [
		'COOKIE_CONTEXT',
		'COOKIE_CHUNK_SIZE',
		'DISALLOWED_PROXY_HEADERS',
		'RETURN_TO_COOKIE',
		'BACKCHANNEL_LOGOUT_TOKEN_MAX_AGE_SECONDS',
		'createBaseServerSDK',
	];

	expect(Object.keys(index)).toEqual(expectedExports);
});
