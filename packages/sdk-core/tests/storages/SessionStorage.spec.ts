import { vi, describe, it, beforeEach, expect } from 'vitest';
import { SessionStorage } from '../../src/storages/SessionStorage';
import * as expectedImports from '../../src/storages/SessionStorage';

describe('SessionStorage', () => {
	const storage = new SessionStorage();
	let getItemSpy;
	let setItemSpy;
	let removeItemSpy;

	beforeEach(() => {
		getItemSpy = vi.spyOn(globalThis.window.sessionStorage, 'getItem');
		setItemSpy = vi.spyOn(globalThis.window.sessionStorage, 'setItem');
		removeItemSpy = vi.spyOn(globalThis.window.sessionStorage, 'removeItem');
	});

	it('should export the correct things', () => {
		expect(Object.keys(expectedImports)).toHaveLength(1);
		expect(expectedImports).toHaveProperty('SessionStorage');
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
