import { configDefaults } from 'vitest/config';
import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
	test: {
		include: ['**/*.spec.ts'],
		setupFiles: ['../../tools/testing/vitest/setup.ts'],
		environment: 'nuxt',
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
		outputFile: '../../reports/sdk-nuxt.xml',
		coverage: {
			enabled: true,
			provider: 'istanbul',
			reporter: ['html', 'lcov'],
			reportsDirectory: '../../coverages/sdk-nuxt',
			exclude: [...configDefaults.coverage.exclude!],
		},
	},
});
