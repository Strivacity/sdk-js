import { vi, describe, test, beforeEach, expect, type MockInstance } from 'vitest';
import { SessionStorage } from '../../src/storages/SessionStorage';
import * as expectedImports from '../../src/storages/SessionStorage';

describe('SessionStorage', () => {
	const storage = new SessionStorage();
	let getItemSpy: MockInstance;
	let setItemSpy: MockInstance;
	let removeItemSpy: MockInstance;

	beforeEach(() => {
		getItemSpy = vi.spyOn(globalThis.window.sessionStorage, 'getItem');
		setItemSpy = vi.spyOn(globalThis.window.sessionStorage, 'setItem');
		removeItemSpy = vi.spyOn(globalThis.window.sessionStorage, 'removeItem');
	});

	test('should export the correct things', () => {
		expect(Object.keys(expectedImports)).toHaveLength(1);
		expect(expectedImports).toHaveProperty('SessionStorage');
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
