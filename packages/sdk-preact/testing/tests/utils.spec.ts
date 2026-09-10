import { test, expect } from 'vitest';
import * as preactUtils from '../../src/utils';
import * as coreUtils from '@strivacity/sdk-core/utils';

test('re-exports utility from the core sdk', () => {
	const coreKeys = Object.keys(coreUtils);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(preactUtils).sort()).toEqual(coreKeys.sort());
});
