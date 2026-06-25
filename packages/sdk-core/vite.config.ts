import { resolve, extname, relative } from 'node:path';
import { globSync } from 'node:fs';
import { defineConfig } from 'vite';
import dtsPlugin from 'unplugin-dts/vite';

export default defineConfig({
	plugins: [
		dtsPlugin({
			tsconfigPath: './tsconfig.app.json',
			entryRoot: './src',
		}),
	],
	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		sourcemap: true,
		rollupOptions: {
			preserveEntrySignatures: 'allow-extension',
			external: [/@strivacity/],
			input: Object.fromEntries(
				globSync('./src/**/*.ts', { exclude: ['**/*.d.ts'] }).map((file) => [
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
