import { test, expect } from 'vitest';
import * as reactStorages from '../../src/storages';
import * as coreStorages from '@strivacity/sdk-core/storages';

test('re-exports storages from the core sdk', () => {
	const coreKeys = Object.keys(coreStorages);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(reactStorages).sort()).toEqual(coreKeys.sort());
});
