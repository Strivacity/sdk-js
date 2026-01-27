import { configDefaults, defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	test: {
		include: ['**/*.spec.ts'],
		setupFiles: ['../../tools/testing/vitest/setup.ts'],
		environment: 'happy-dom',
		watch: false,
		globals: true,
		clearMocks: true,
		retry: 5,
		pool: 'threads',
		sequence: {
			hooks: 'list',
		},
		reporters: ['verbose', 'junit'],
		outputFile: '../../reports/sdk-svelte.xml',
		coverage: {
			enabled: true,
			provider: 'istanbul',
			reporter: ['html', 'lcov'],
			reportsDirectory: '../../coverages/sdk-svelte',
			exclude: [...configDefaults.coverage.exclude!],
		},
	},
});
