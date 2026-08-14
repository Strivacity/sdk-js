import { test, expect } from 'vitest';
import * as nextStorages from '../../../src/client/storages';
import * as reactStorages from '@strivacity/sdk-react/storages';

test('re-exports storages from the react sdk', () => {
	const reactKeys = Object.keys(reactStorages);

	expect(reactKeys.length).toBeGreaterThan(0);
	expect(Object.keys(nextStorages).sort()).toEqual(reactKeys.sort());
});
