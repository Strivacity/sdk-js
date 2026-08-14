import { test, expect } from 'vitest';
import * as nuxtStorages from '../../src/runtime/storages/core';
import * as coreStorages from '@strivacity/sdk-core/storages';

test('re-exports the client-safe storages from the core sdk', () => {
	const coreKeys = Object.keys(coreStorages);

	expect(coreKeys.length).toBeGreaterThan(0);

	for (const key of Object.keys(nuxtStorages)) {
		expect(coreKeys).toContain(key);
	}

	expect(nuxtStorages).not.toHaveProperty('createSessionIdCookieStorage');
	expect(nuxtStorages).not.toHaveProperty('createEncryptedCookieStorage');
});
