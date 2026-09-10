import { defineConfig } from 'vitest/config';
import { getVitestConfig } from '@strivacity/testing/vitest/config';

const vitestConfig = getVitestConfig('angular');

export default defineConfig({
	test: {
		...vitestConfig,
		setupFiles: [...vitestConfig.setupFiles!, './testing/setup.ts'],
	},
});
