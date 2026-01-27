import { resolve, relative, extname } from 'node:path';
import { defineConfig } from 'vite';
import { glob } from 'glob';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import dtsPlugin from 'vite-plugin-dts';

export default defineConfig({
	plugins: [
		svelte(),
		dtsPlugin({
			tsconfigPath: './tsconfig.app.json',
			entryRoot: './src',
			include: ['./src'],
		}),
	],
	build: {
		reportCompressedSize: true,
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			preserveEntrySignatures: 'allow-extension',
			external: [/^@strivacity/, /^svelte*/],
			input: Object.fromEntries(
				glob
					.sync('./src/**/*.{ts,svelte}', { ignore: ['**/*.d.ts'] })
					.map((file) => [relative('./src', file.slice(0, file.length - extname(file).length)), resolve(file)]),
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
