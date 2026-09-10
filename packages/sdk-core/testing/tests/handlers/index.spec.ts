import { test, expect } from 'vitest';
import * as index from '../../../src/handlers';

test('should export the correct things', () => {
	const expectedExports = ['popupUrlHandler', 'popupCallbackHandler', 'redirectUrlHandler', 'redirectCallbackHandler'];

	expect(Object.keys(index)).toEqual(expectedExports);
});
