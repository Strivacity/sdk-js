// Stub for the Nuxt-generated '#app' virtual module, aliased in vite.config.mts because
// plain Vite/vitest can't resolve it outside a running Nuxt build. Individual tests override
// this via vi.mock('#app', ...) before importing the composable under test.
export function useRuntimeConfig() {
	return { public: { strivacity: {} } };
}
