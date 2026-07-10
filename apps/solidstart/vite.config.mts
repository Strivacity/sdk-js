import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { fileRoutes } from 'filesystem-routing/vite';
import solidPlugin from '@solidjs/vite-plugin';

export default defineConfig({
	envDir: searchForWorkspaceRoot(process.cwd()),
	root: __dirname,
	build: {
		emptyOutDir: true,
		target: 'esnext',
		assetsInlineLimit: 0,
	},
	plugins: [
		solidPlugin({
			start: { middleware: './src/middleware.ts' },
			ssr: true,
			serverFunctions: true,
			extensions: ['.jsx', '.tsx'],
		}),
		fileRoutes(),
	],
	server: {
		port: 4200,
		host: 'localhost',
		cors: {
			credentials: true,
			origin: true,
		},
		fs: {
			allow: [resolve(__dirname, '../..')],
		},
	},
});
