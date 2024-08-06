import { vi, describe, it, beforeEach, expect } from 'vitest';
import { LocalStorage } from '../../src/storages/LocalStorage';
import * as expectedImports from '../../src/storages/LocalStorage';

describe('LocalStorage', () => {
	const storage = new LocalStorage();
	let getItemSpy;
	let setItemSpy;
	let removeItemSpy;

	beforeEach(() => {
		getItemSpy = vi.spyOn(globalThis.window.localStorage, 'getItem');
		setItemSpy = vi.spyOn(globalThis.window.localStorage, 'setItem');
		removeItemSpy = vi.spyOn(globalThis.window.localStorage, 'removeItem');
	});

	it('should export the correct things', () => {
		expect(Object.keys(expectedImports)).toHaveLength(1);
		expect(expectedImports).toHaveProperty('LocalStorage');
	});

	it('getItem', async () => {
		storage.get('test');
		expect(getItemSpy).toHaveBeenCalledWith('test');
	});

	it('setItem', async () => {
		storage.set('test', 'value');
		expect(setItemSpy).toHaveBeenCalledWith('test', 'value');
	});

	it('setItem', async () => {
		storage.delete('test');
		expect(removeItemSpy).toHaveBeenCalledWith('test');
	});
});
