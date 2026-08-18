import { test, expect } from 'vitest';
import * as solidStorages from '../../src/client/storages';
import * as coreStorages from '@strivacity/sdk-core/storages';

test('re-exports storages from the core sdk', () => {
	const coreKeys = Object.keys(coreStorages);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(solidStorages).sort()).toEqual(coreKeys.sort());
});
