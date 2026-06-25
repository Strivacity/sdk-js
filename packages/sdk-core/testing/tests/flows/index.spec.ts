import { test, expect } from 'vitest';
import * as index from '../../../src/flows';

test('should export the correct things', () => {
	const expectedExports = ['createBaseFlow', 'createEmbeddedFlow', 'createNativeFlow', 'createPopupFlow', 'createRedirectFlow'];

	expect(Object.keys(index)).toEqual(expectedExports);
});
