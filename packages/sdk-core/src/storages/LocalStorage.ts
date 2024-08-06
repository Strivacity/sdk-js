import type { SDKStorage } from '../types';

export class LocalStorage implements SDKStorage {
	get(key: string) {
		return globalThis?.window?.localStorage?.getItem(key);
	}
	delete(key: string) {
		globalThis?.window?.localStorage.removeItem(key);
	}
	set(key: string, value: string) {
		globalThis?.window?.localStorage.setItem(key, value);
	}
}
