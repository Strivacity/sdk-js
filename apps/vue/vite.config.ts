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
	plugins: [vuePlugin()],
	server: {
		port: 4200,
		host: 'localhost',
		headers: {
			'Access-Control-Allow-Origin': 'null',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Authorization,DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range',
			'Access-Control-Allow-Credentials': 'true',
		},
		fs: {
			allow: [resolve(__dirname, '../..')],
		},
	},
});
