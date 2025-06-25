import { resolve } from 'node:path';
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	ssr: false,
	buildDir: './.nuxt',
	workspaceDir: resolve(__dirname, '../../'),
	devtools: { enabled: true },
	imports: { autoImport: true },
	compatibilityDate: '2025-04-11',
	future: { compatibilityVersion: 4 },
	typescript: {
		typeCheck: true,
		// NOTE: Extend .nuxt/tsconfig.json
		tsConfig: {
			extends: '../tsconfig.app.json',
		},
	},
	devServer: { host: 'localhost', port: 4200 },
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		mode: 'redirect',
		issuer: process.env.VITE_ISSUER,
		scopes: process.env.VITE_SCOPES?.split(' '),
		clientId: process.env.VITE_CLIENT_ID,
		redirectUri: 'http://localhost:4200/callback',
		storageTokenName: 'sty.session.nuxt',
	},
});
