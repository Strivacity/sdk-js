import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { vitePlugin as remixPlugin } from '@remix-run/dev';

export default defineConfig({
	envDir: searchForWorkspaceRoot(process.cwd()),
	root: __dirname,
	build: {
		reportCompressedSize: true,
		commonjsOptions: {
			transformMixedEsModules: true,
		},
	},
	esbuild: {
		supported: {
			'top-level-await': true,
		},
	},
	plugins: [remixPlugin({ appDirectory: 'src' }), nxViteTsPaths()],
	server: {
		port: 4200,
		host: 'localhost',
		fs: {
			allow: [resolve(__dirname, '../..')],
		},
	},
});
