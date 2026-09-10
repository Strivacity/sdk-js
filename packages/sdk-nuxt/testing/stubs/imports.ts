// Stub for the Nuxt-generated '#imports' virtual module, aliased in vite.config.mts (see app.ts
// for why). Individual tests override this via vi.mock('#imports', ...) as needed.
import { ref } from 'vue';

export function useState<T>(_key: string, init?: () => T) {
	return ref(init ? init() : undefined);
}

export function useNuxtApp() {
	return {};
}

export function defineNuxtRouteMiddleware<T extends (...args: Array<never>) => unknown>(fn: T) {
	return fn;
}

export function useRuntimeConfig() {
	return { strivacity: {} };
}
