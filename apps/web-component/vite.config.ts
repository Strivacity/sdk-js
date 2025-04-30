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
		headers: {
			'Access-Control-Allow-Origin': 'null',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Authorization,DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range',
			'Access-Control-Allow-Credentials': 'true',
		},
	},
});
