import { composePlugins, withNx } from '@nx/next';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
	output: 'export',
	reactStrictMode: false,
	trailingSlash: false,
	distDir: './dist',
	env: {
		MODE: process.env.VITE_MODE,
		ISSUER: process.env.VITE_ISSUER,
		REDIRECT_URI: process.env.VITE_REDIRECT_URI,
		CLIENT_ID: process.env.VITE_CLIENT_ID,
		SCOPES: process.env.VITE_SCOPES,
		AUDIENCES: process.env.VITE_AUDIENCES,
	},
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
