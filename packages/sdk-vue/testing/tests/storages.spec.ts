import { test, expect } from 'vitest';
import * as vueStorages from '../../src/storages';
import * as coreStorages from '@strivacity/sdk-core/storages';

test('re-exports storages from the core sdk', () => {
	const coreKeys = Object.keys(coreStorages);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(vueStorages).sort()).toEqual(coreKeys.sort());
});
