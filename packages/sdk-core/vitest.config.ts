import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['**/*.spec.ts'],
		setupFiles: ['../../tools/testing/vitest/setup.ts'],
		environment: 'happy-dom',
		watch: false,
		globals: true,
		mockReset: true,
		clearMocks: true,
		retry: 5,
		pool: 'threads',
		sequence: {
			hooks: 'list',
		},
		reporters: ['verbose', 'junit'],
		outputFile: '../../reports/sdk-core.xml',
		coverage: {
			enabled: true,
			provider: 'istanbul',
			reporter: ['html', 'lcov'],
			reportsDirectory: '../../coverages/sdk-core',
			exclude: [...configDefaults.coverage.exclude!],
		},
	},
});
