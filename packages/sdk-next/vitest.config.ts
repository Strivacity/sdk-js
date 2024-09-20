import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		watch: false,
		pool: 'threads',
		setupFiles: ['@strivacity/vitest/setup.ts'],
		environment: 'happy-dom',
		sequence: {
			hooks: 'list',
		},
		reporters: ['verbose', 'junit'],
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'html', 'lcov'],
			exclude: [...configDefaults.coverage.exclude!],
			reportsDirectory: '../../coverages/sdk-next',
		},
		outputFile: '../../reports/sdk-next.xml',
	},
});
