import { test, expect } from 'vitest';
import * as vueErrors from '../../src/errors';
import * as coreErrors from '@strivacity/sdk-core/utils/errors';

test('re-exports error classes from the core sdk', () => {
	const coreKeys = Object.keys(coreErrors);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(vueErrors).sort()).toEqual(coreKeys.sort());
});
