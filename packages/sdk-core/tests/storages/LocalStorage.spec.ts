import { vi, describe, test, beforeEach, expect, type MockInstance } from 'vitest';
import { LocalStorage } from '../../src/storages/LocalStorage';
import * as expectedImports from '../../src/storages/LocalStorage';

describe('LocalStorage', () => {
	const storage = new LocalStorage();
	let getItemSpy: MockInstance;
	let setItemSpy: MockInstance;
	let removeItemSpy: MockInstance;

	beforeEach(() => {
		getItemSpy = vi.spyOn(globalThis.window.localStorage, 'getItem');
		setItemSpy = vi.spyOn(globalThis.window.localStorage, 'setItem');
		removeItemSpy = vi.spyOn(globalThis.window.localStorage, 'removeItem');
	});

	test('should export the correct things', () => {
		expect(Object.keys(expectedImports)).toHaveLength(1);
		expect(expectedImports).toHaveProperty('LocalStorage');
	});

	test('get', async () => {
		await storage.get('test');
		expect(getItemSpy).toHaveBeenCalledWith('test');
	});

	test('set', async () => {
		await storage.set('test', 'value');
		expect(setItemSpy).toHaveBeenCalledWith('test', 'value');
	});

	test('delete', async () => {
		await storage.delete('test');
		expect(removeItemSpy).toHaveBeenCalledWith('test');
	});
});
