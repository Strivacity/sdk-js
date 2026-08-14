import { test, expect } from 'vitest';
import * as svelteUtils from '../../src/client/utils';
import * as coreUtils from '@strivacity/sdk-core/utils';

test('re-exports utility from the core sdk', () => {
	const coreKeys = Object.keys(coreUtils);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(svelteUtils).sort()).toEqual(coreKeys.sort());
});
