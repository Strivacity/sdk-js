const { DefinePlugin } = require('webpack');

module.exports = {
	plugins: [
		new DefinePlugin({
			'import.meta.env.VITE_MODE': JSON.stringify(process.env.VITE_MODE),
			'import.meta.env.VITE_ISSUER': JSON.stringify(process.env.VITE_ISSUER),
			'import.meta.env.VITE_REDIRECT_URI': JSON.stringify(process.env.VITE_REDIRECT_URI),
			'import.meta.env.VITE_CLIENT_ID': JSON.stringify(process.env.VITE_CLIENT_ID),
			'import.meta.env.VITE_SCOPES': JSON.stringify(process.env.VITE_SCOPES),
			'import.meta.env.VITE_LOGIN_HINT': JSON.stringify(process.env.VITE_LOGIN_HINT),
			'import.meta.env.VITE_ACR_VALUES': JSON.stringify(process.env.VITE_ACR_VALUES),
			'import.meta.env.VITE_UI_LOCALES': JSON.stringify(process.env.VITE_UI_LOCALES),
			'import.meta.env.VITE_AUDIENCES': JSON.stringify(process.env.VITE_AUDIENCES),
		}),
	],
	devServer: {
		port: 4200,
		host: 'localhost',
	},
};
