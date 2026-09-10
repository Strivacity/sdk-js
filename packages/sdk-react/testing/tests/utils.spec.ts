import { test, expect } from 'vitest';
import * as reactUtils from '../../src/utils';
import * as coreUtils from '@strivacity/sdk-core/utils';

test('re-exports utility from the core sdk', () => {
	const coreKeys = Object.keys(coreUtils);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(reactUtils).sort()).toEqual(coreKeys.sort());
});
