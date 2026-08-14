import { resolve, relative, extname } from 'node:path';
import { globSync } from 'node:fs';
import { defineConfig } from 'vite';
import { getVitestConfig } from '@strivacity/testing/vitest/config';
import vuePlugin from '@vitejs/plugin-vue';
import dtsPlugin from 'unplugin-dts/vite';

export default defineConfig({
	plugins: [
		vuePlugin({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag.startsWith('sty-'),
				},
			},
		}),
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
			external: [/@strivacity/, /^vue/],
			input: Object.fromEntries(
				globSync('./src/**/*.{ts,vue}', { exclude: ['**/*.d.ts'] }).map((file) => [
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
	test: getVitestConfig('vue'),
});
