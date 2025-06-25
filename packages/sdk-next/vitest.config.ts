import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		setupFiles: ['@strivacity/vitest/setup.ts'],
		environment: 'happy-dom',
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
			reportsDirectory: '../../coverages/sdk-next',
		},
		outputFile: '../../reports/sdk-next.xml',
	},
});
