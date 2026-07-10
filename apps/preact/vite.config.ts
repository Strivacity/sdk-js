import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import preactPlugin from '@preact/preset-vite';

export default defineConfig({
	envDir: searchForWorkspaceRoot(process.cwd()),
	root: __dirname,
	build: {
		emptyOutDir: true,
	},
	plugins: [preactPlugin()],
	server: {
		port: 4200,
		host: 'localhost',
		fs: {
			allow: [resolve(__dirname, '../..')],
		},
	},
});
