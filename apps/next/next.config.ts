import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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

export default nextConfig;
