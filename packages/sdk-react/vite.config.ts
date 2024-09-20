import { resolve, relative, extname } from 'node:path';
import { defineConfig } from 'vite';
import { glob } from 'glob';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import dtsPlugin from 'vite-plugin-dts';

export default defineConfig({
	plugins: [nxViteTsPaths(), dtsPlugin({ entryRoot: './src', include: ['./src'] })],
	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		sourcemap: true,
		rollupOptions: {
			preserveEntrySignatures: 'allow-extension',
			external: [/@strivacity/, /^react*/],
			input: Object.fromEntries(
				glob
					.sync('packages/sdk-react/src/**/*.tsx', { ignore: ['**/*.d.ts'] })
					.map((file) => [relative('packages/sdk-react/src', file.slice(0, file.length - extname(file).length)), resolve(file)]),
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
