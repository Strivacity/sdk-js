import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	envDir: searchForWorkspaceRoot(process.cwd()),
	build: {
		target: 'node22',
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index',
		},
		rollupOptions: {
			external: [/^node:/, 'express', 'cors', 'path', 'url', 'fs'],
		},
		outDir: 'dist',
		emptyOutDir: true,
	},
});
