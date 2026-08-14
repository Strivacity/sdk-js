import { test, expect } from 'vitest';
import * as nuxtUtils from '../../src/runtime/utils/core';
import * as coreUtils from '@strivacity/sdk-core/utils';

test('re-exports utility from the core sdk', () => {
	const coreKeys = Object.keys(coreUtils);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(nuxtUtils).sort()).toEqual(coreKeys.sort());
});
