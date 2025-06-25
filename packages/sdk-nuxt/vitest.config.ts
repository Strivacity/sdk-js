import { configDefaults } from 'vitest/config';
import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
	test: {
		setupFiles: ['@strivacity/vitest/setup.ts'],
		environment: 'nuxt',
		watch: false,
		globals: true,
		mockReset: true,
		pool: 'threads',
		sequence: {
			hooks: 'list',
		},
		reporters: ['verbose', 'junit'],
		coverage: {
			enabled: true,
			provider: 'istanbul',
			reporter: ['text', 'html', 'lcov'],
			exclude: [...configDefaults.coverage.exclude!],
			reportsDirectory: '../../coverages/sdk-nuxt',
		},
		outputFile: '../../reports/sdk-nuxt.xml',
	},
});
