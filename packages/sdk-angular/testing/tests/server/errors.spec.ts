import { test, expect } from 'vitest';
import * as angularErrors from '../../../src/server/errors';
import * as coreErrors from '@strivacity/sdk-core/utils/errors';

test('re-exports error classes from the core sdk', () => {
	const coreKeys = Object.keys(coreErrors);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(angularErrors).sort()).toEqual(coreKeys.sort());

	for (const key of coreKeys) {
		expect(angularErrors[key as keyof typeof angularErrors]).toBe(coreErrors[key as keyof typeof coreErrors]);
	}
});
