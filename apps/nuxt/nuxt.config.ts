import { resolve } from 'node:path';
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	telemetry: false,
	devtools: { enabled: true },
	buildDir: './.nuxt',
	workspaceDir: resolve(__dirname, '../../'),
	typescript: {
		typeCheck: true,
		tsConfig: {
			extends: '../tsconfig.app.json',
		},
	},
	devServer: { host: 'localhost', port: 4200 },
	modules: ['@strivacity/sdk-nuxt'],
	runtimeConfig: {
		public: {
			MODE: process.env.VITE_MODE,
			LOGIN_HINT: process.env.VITE_LOGIN_HINT,
			ACR_VALUES: process.env.VITE_ACR_VALUES,
			UI_LOCALES: process.env.VITE_UI_LOCALES,
			AUDIENCES: process.env.VITE_AUDIENCES,
		},
	},
	vue: {
		compilerOptions: { isCustomElement: (tag) => tag.startsWith('sty-') },
	},
	strivacity: {
		mode: process.env.VITE_MODE as never,
		issuer: process.env.VITE_ISSUER,
		scopes: process.env.VITE_SCOPES?.split(' '),
		clientId: process.env.VITE_CLIENT_ID,
		redirectUri: process.env.VITE_REDIRECT_URI,
		secret: process.env.VITE_SECRET,
		storageTokenName: 'sty.session.nuxt',
		postLoginRedirectUri: '/profile',
		serverSessionUri: '/auth/login', // If you want to use client-side session storage, you can set this to false.
	},
});
