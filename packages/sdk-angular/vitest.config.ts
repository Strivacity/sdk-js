import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		watch: false,
		pool: 'threads',
		setupFiles: ['./tests/setup.ts'],
		environment: 'happy-dom',
		sequence: {
			hooks: 'list',
		},
		reporters: ['verbose', 'junit'],
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'html', 'lcov'],
			exclude: [...configDefaults.coverage.exclude!],
			reportsDirectory: '../../coverages/sdk-angular',
		},
		outputFile: '../../reports/sdk-angular.xml',
	},
});
