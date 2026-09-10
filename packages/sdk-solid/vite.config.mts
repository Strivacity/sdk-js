import { resolve, relative, extname } from 'node:path';
import { globSync } from 'node:fs';
import { defineConfig } from 'vite';
import { getVitestConfig } from '@strivacity/testing/vitest/config';
import dtsPlugin from 'unplugin-dts/vite';
import solid from '@solidjs/vite-plugin';
import { preserveDirectivesPlugin } from '@strivacity/common/vite/plugins';

export default defineConfig({
	plugins: [
		solid(),
		preserveDirectivesPlugin(),
		dtsPlugin({
			tsconfigPath: './tsconfig.app.json',
			entryRoot: './src',
		}),
	],
	build: {
		reportCompressedSize: true,
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			preserveEntrySignatures: 'allow-extension',
			external: [/@strivacity/, /^solid-js/, /@solidjs/],
			input: Object.fromEntries(
				globSync('./src/**/*.{ts,tsx}', { exclude: ['**/*.d.ts'] }).map((file) => [
					relative('./src', file.slice(0, file.length - extname(file).length)),
					resolve(file),
				]),
			),
			output: [
				{
					format: 'esm',
					entryFileNames: '[name].mjs',
					chunkFileNames: 'assets/[name].mjs',
					assetFileNames: 'assets/[name].[extname]',
				},
				{
					format: 'commonjs',
					entryFileNames: '[name].cjs',
					chunkFileNames: 'assets/[name].cjs',
					assetFileNames: 'assets/[name].[extname]',
				},
			],
		},
	},
	test: getVitestConfig('solid'),
});
