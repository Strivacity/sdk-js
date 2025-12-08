import { vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { State } from '../../../packages/sdk-core/src/utils/State';
import { Session } from '../../../packages/sdk-core/src/utils/Session';
import { jwt } from '../../../packages/sdk-core/src/utils/jwt';
import { timestamp } from '../../../packages/sdk-core/src/utils/date';

export class Storage {
	data = new Map();
	spies: Record<string, MockInstance> = {};

	get(key: string) {
		return this.data.get(key);
	}

	set(key: string, value: string) {
		return this.data.set(key, value);
	}

	delete(key: string) {
		return this.data.delete(key);
	}

	clear() {
		return this.data.clear();
	}

	keys() {
		return this.data.keys();
	}

	values() {
		return this.data.values();
	}

	getFirstKey() {
		return Array.from(this.keys()).unshift();
	}

	getLastKey() {
		return Array.from(this.keys()).pop();
	}

	getLastState(): State | undefined {
		const key = Array.from(this.keys())
			.reverse()
			.find((key) => key.startsWith('sty.'));

		if (key) {
			return JSON.parse(this.get(key));
		}
	}

	getSession(key = 'sty.session'): Session | undefined {
		return this.get(key);
	}

	async generateState(overrides?: Partial<Session>, store = true): Promise<State> {
		const state = await State.create();

		Object.assign(state, overrides);

		if (store) {
			this.set(`sty.${state.id}`, JSON.stringify(state));
		}

		return state;
	}

	generateSession(overrides?: Partial<Session>, storageKey: string | null = 'sty.session'): Session {
		const session = new Session();

		session.access_token = `${crypto.randomUUID().replace(/-/g, '')}.${crypto.randomUUID().replace(/-/g, '')}`;
		session.refresh_token = `${crypto.randomUUID().replace(/-/g, '')}.${crypto.randomUUID().replace(/-/g, '')}`;
		session.scope = 'openid profile';
		session.expires_in = 3600;
		session.expires_at = timestamp() + 3600;
		session.claims = {
			iss: 'https://brandtegrity.io/',
			aud: [crypto.randomUUID().replace(/-/g, '')],
			nonce: crypto.randomUUID().replace(/-/g, ''),
			auth_time: timestamp(),
			exp: timestamp(),
			iat: timestamp(),
			jti: crypto.randomUUID(),
			sid: crypto.randomUUID(),
			sub: crypto.randomUUID(),
		};
		session.id_token = jwt.generateUnsigned({ typ: 'JWT' }, session.claims);

		Object.assign(session, overrides);

		if (storageKey) {
			this.set(storageKey, JSON.stringify(session));
		}

		return session;
	}
}

const storages: Record<string, Storage> = {
	local: new Storage(),
	session: new Storage(),
};

export function mockLocalStorage() {
	vi.spyOn(globalThis.window.localStorage, 'getItem').mockImplementation((key: string) => storages.local.get(key));
	vi.spyOn(globalThis.window.localStorage, 'setItem').mockImplementation((key: string, value: string) => storages.local.set(key, value));
	vi.spyOn(globalThis.window.localStorage, 'removeItem').mockImplementation((key: string) => storages.local.delete(key));

	storages.local.spies = {
		get: vi.spyOn(storages.local, 'get'),
		set: vi.spyOn(storages.local, 'set'),
		delete: vi.spyOn(storages.local, 'delete'),
	};

	return storages.local;
}

export function mockSessionStorage() {
	vi.spyOn(globalThis.window.sessionStorage, 'getItem').mockImplementation((key: string) => storages.session.get(key));
	vi.spyOn(globalThis.window.sessionStorage, 'setItem').mockImplementation((key: string, value: string) => storages.session.set(key, value));
	vi.spyOn(globalThis.window.sessionStorage, 'removeItem').mockImplementation((key: string) => storages.session.delete(key));

	storages.session.spies = {
		get: vi.spyOn(storages.session, 'get'),
		set: vi.spyOn(storages.session, 'set'),
		delete: vi.spyOn(storages.session, 'delete'),
	};

	return storages.session;
}

afterEach(() => {
	for (const key in storages) {
		storages[key].clear();
	}
});
