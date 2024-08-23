import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	workspaceDir: '../../',
	buildDir: './.nuxt',
	srcDir: './src',
	devServer: { host: 'localhost', port: 4200 },
	compatibilityDate: '2024-08-14',
	devtools: { enabled: true },
	modules: ['@strivacity/sdk-nuxt'],
	strivacity: {
		issuer: process.env.VITE_ISSUER,
		scopes: process.env.VITE_SCOPES?.split(' '),
		clientId: process.env.VITE_CLIENT_ID,
		redirectUri: 'http://localhost:4200/callback',
		storageTokenName: 'sty.session.nuxt',
	},
});
