import { test, expect } from 'vitest';
import * as serverUtils from '../../../src/server/utils';
import * as coreUtils from '@strivacity/sdk-core/utils';

test('re-exports utility from the core sdk', () => {
	const coreKeys = Object.keys(coreUtils);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(serverUtils).sort()).toEqual(coreKeys.sort());
});
