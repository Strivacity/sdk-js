/// <reference types="vitest" />

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dtsPlugin from 'vite-plugin-dts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [
		dtsPlugin({
			include: ['src'],
			rollupTypes: true,
		}),
	],
	build: {
		copyPublicDir: false,
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			fileName: 'index',
			formats: ['es', 'cjs'],
		},
	},
	test: {
		watch: false,
		globals: true,
		environment: 'jsdom',
		coverage: {
			enabled: true,
			provider: 'v8',
			reportOnFailure: true,
			reportsDirectory: 'coverage',
			reporter: ['text', 'json-summary', 'json', 'html'],
		},
		setupFiles: [
			'./testing/setup.ts',
		],
	},
});
