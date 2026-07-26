import { resolve, relative, extname } from 'node:path';
import { globSync } from 'node:fs';
import { defineConfig } from 'vite';
import dtsPlugin from 'unplugin-dts/vite';
import { preserveDirectivesPlugin } from '@strivacity/common/vite/plugins';

export default defineConfig({
	plugins: [
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
			external: [/@strivacity/, /^preact/],
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
});
