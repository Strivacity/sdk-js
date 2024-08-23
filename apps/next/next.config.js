import { composePlugins, withNx } from '@nx/next';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
	output: 'export',
	trailingSlash: true,
	distDir: './dist',
	env: {
		ISSUER: process.env.VITE_ISSUER,
		CLIENT_ID: process.env.VITE_CLIENT_ID,
		SCOPES: process.env.VITE_SCOPES,
	},
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
