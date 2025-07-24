import { resolve, relative, extname } from 'node:path';
import { defineConfig } from 'vite';
import { glob } from 'glob';
import vuePlugin from '@vitejs/plugin-vue';
import dtsPlugin from 'vite-plugin-dts';

export default defineConfig({
	plugins: [
		vuePlugin(),
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
			external: [/^@strivacity/, /^vue*/],
			input: Object.fromEntries(
				glob
					.sync('./src/**/*.{ts,vue}', { ignore: ['**/*.d.ts'] })
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
