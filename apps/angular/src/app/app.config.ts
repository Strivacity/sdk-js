export interface ImportMeta {
	env: {
		VITE_MODE: 'redirect' | 'popup' | 'native';
		VITE_ISSUER: string;
		VITE_SCOPES: string;
		VITE_CLIENT_ID: string;
		VITE_REDIRECT_URI: string;
		VITE_LOGIN_HINT: string;
		VITE_ACR_VALUES: string;
		VITE_UI_LOCALES: string;
		VITE_AUDIENCES: string;
	};
}
