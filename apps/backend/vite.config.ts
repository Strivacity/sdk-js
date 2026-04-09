import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	envDir: resolve(__dirname, '..'),
	build: {
		target: 'node20',
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index',
		},
		rollupOptions: {
			external: ['express', 'cors', 'path', 'url', 'fs'],
		},
		outDir: 'dist',
		emptyOutDir: true,
	},
});
