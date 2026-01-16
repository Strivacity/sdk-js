import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	ssr: true,
	telemetry: false,
	modules: ['./src'],
	strivacity: {
		issuer: 'https://brandtegrity.io',
		scopes: ['openid', 'profile'],
		clientId: '2202c596c06e4774b42804af00c66df9',
		redirectUri: 'https://brandtegrity.io/app/callback/',
		responseType: 'code',
		responseMode: 'query',
	},
});
