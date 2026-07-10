import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import vuePlugin from '@vitejs/plugin-vue';

export default defineConfig({
	envDir: searchForWorkspaceRoot(process.cwd()),
	root: __dirname,
	build: {
		emptyOutDir: true,
	},
	plugins: [
		vuePlugin({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag.startsWith('sty-'),
				},
			},
		}),
	],
	server: {
		port: 4200,
		host: 'localhost',
		cors: {
			credentials: true,
			origin: true,
		},
		proxy: {
			'/auth': {
				target: 'http://localhost:3000',
			},
		},
		fs: {
			allow: [resolve(__dirname, '../..')],
		},
	},
});
