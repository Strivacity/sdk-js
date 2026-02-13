import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import vuePlugin from '@vitejs/plugin-vue';

export default defineConfig({
	envDir: searchForWorkspaceRoot(process.cwd()),
	root: __dirname,
	build: {
		reportCompressedSize: true,
		emptyOutDir: true,
		commonjsOptions: {
			transformMixedEsModules: true,
		},
	},
	esbuild: {
		supported: {
			'top-level-await': true,
		},
	},
	plugins: [
		vuePlugin({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag.includes('sty-'),
				},
			},
		}),
	],
	server: {
		port: 4200,
		host: 'localhost',
		fs: {
			allow: [resolve(__dirname, '../..')],
		},
	},
});
