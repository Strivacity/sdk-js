import { configDefaults, defineConfig } from 'vitest/config';
import vuePlugin from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [vuePlugin()],
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
		outputFile: '../../reports/sdk-vue.xml',
		coverage: {
			enabled: true,
			provider: 'istanbul',
			reporter: ['html', 'lcov'],
			reportsDirectory: '../../coverages/sdk-vue',
			exclude: [...configDefaults.coverage.exclude!],
		},
	},
});
