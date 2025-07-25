const { DefinePlugin } = require('webpack');

module.exports = {
	plugins: [
		new DefinePlugin({
			'import.meta.env.VITE_MODE': JSON.stringify(process.env.VITE_MODE),
			'import.meta.env.VITE_ISSUER': JSON.stringify(process.env.VITE_ISSUER),
			'import.meta.env.VITE_REDIRECT_URI': JSON.stringify(process.env.VITE_REDIRECT_URI),
			'import.meta.env.VITE_CLIENT_ID': JSON.stringify(process.env.VITE_CLIENT_ID),
			'import.meta.env.VITE_SCOPES': JSON.stringify(process.env.VITE_SCOPES),
		}),
	],
	devServer: {
		port: 4200,
		host: 'localhost',
	},
};
