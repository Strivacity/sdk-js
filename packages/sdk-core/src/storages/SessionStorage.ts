import type { SDKStorage } from '../types';

export class SessionStorage implements SDKStorage {
	get(key: string) {
		return globalThis?.window?.sessionStorage?.getItem(key);
	}
	delete(key: string) {
		globalThis?.window?.sessionStorage.removeItem(key);
	}
	set(key: string, value: string) {
		globalThis?.window?.sessionStorage.setItem(key, value);
	}
}
