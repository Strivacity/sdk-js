import type { InlineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

export function getVitestConfig(sdkName: string): InlineConfig {
	return {
		include: ['**/*.spec.ts', '**/*.spec.tsx'],
		setupFiles: ['../../tools/testing/vitest/setup.ts'],
		environment: 'happy-dom',
		watch: false,
		globals: true,
		mockReset: true,
		clearMocks: true,
		testTimeout: 15_000,
		retry: 2,
		pool: 'forks',
		maxWorkers: 2,
		sequence: {
			hooks: 'list',
		},
		reporters: ['default', 'junit'],
		coverage: {
			enabled: true,
			provider: 'istanbul',
			reporter: ['html', 'lcov'],
			exclude: [configDefaults.coverage.exclude!],
			reportsDirectory: `../../coverages/sdk-${sdkName}`,
		},
		outputFile: `../../reports/sdk-${sdkName}.xml`,
	};
}
