import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
	envDir: searchForWorkspaceRoot(process.cwd()),
	root: __dirname,
	build: {
		target: 'esnext',
	},
	server: {
		port: 4200,
		host: 'localhost',
	},
});
