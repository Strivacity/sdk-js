import type { NextConfig } from 'next';
import { composePlugins, withNx } from '@nx/next';

const nextConfig: NextConfig = {
	// output: 'export',
	// reactStrictMode: false,
	trailingSlash: false,
	allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io'],
	distDir: './dist',
	env: {
		MODE: process.env.VITE_MODE,
		ISSUER: process.env.VITE_ISSUER,
		REDIRECT_URI: process.env.VITE_REDIRECT_URI,
		CLIENT_ID: process.env.VITE_CLIENT_ID,
		SCOPES: process.env.VITE_SCOPES,
		AUDIENCES: process.env.VITE_AUDIENCES,
		LOGIN_HINT: process.env.VITE_LOGIN_HINT,
		ACR_VALUES: process.env.VITE_ACR_VALUES,
		UI_LOCALES: process.env.VITE_UI_LOCALES,
		SECRET: process.env.VITE_SECRET,
	},
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
