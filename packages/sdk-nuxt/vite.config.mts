import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { getVitestConfig } from '@strivacity/testing/vitest/config';

// Nuxt's virtual/auto-import modules (#app, #imports, #strivacity-options-*) only exist inside a
// running Nuxt dev/build context. Point them at local stubs so plain Vite/vitest can resolve the
// bare specifiers at transform time; individual tests can still vi.mock() over these stubs.
export default defineConfig({
	test: getVitestConfig('nuxt'),
	resolve: {
		alias: {
			'#app': fileURLToPath(new URL('./testing/stubs/app.ts', import.meta.url)),
			'#imports': fileURLToPath(new URL('./testing/stubs/imports.ts', import.meta.url)),
			'#strivacity-options-logging': fileURLToPath(new URL('./testing/stubs/options-logging.ts', import.meta.url)),
			'#strivacity-options-httpClient': fileURLToPath(new URL('./testing/stubs/options-httpClient.ts', import.meta.url)),
			'#strivacity-options-storage': fileURLToPath(new URL('./testing/stubs/options-storage.ts', import.meta.url)),
			'#strivacity-options-stateStorage': fileURLToPath(new URL('./testing/stubs/options-stateStorage.ts', import.meta.url)),
		},
	},
});
