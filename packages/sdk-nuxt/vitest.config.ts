import { configDefaults } from 'vitest/config';
import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
	test: {
		globals: true,
		watch: false,
		pool: 'threads',
		setupFiles: ['@strivacity/vitest/setup.ts'],
		environment: 'nuxt',
		sequence: {
			hooks: 'list',
		},
		reporters: ['verbose', 'junit'],
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'html', 'lcov'],
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			exclude: [...configDefaults.coverage.exclude!],
			reportsDirectory: '../../coverages/sdk-nuxt',
		},
		outputFile: '../../reports/sdk-nuxt.xml',
	},
});
