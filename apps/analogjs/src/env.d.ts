interface ImportMetaEnv {
	readonly VITE_MODE: string;
	readonly VITE_ISSUER: string;
	readonly VITE_CLIENT_ID: string;
	readonly VITE_SCOPES: string;
	readonly VITE_REDIRECT_URI: string;
	readonly VITE_LOGIN_HINT?: string;
	readonly VITE_ACR_VALUES?: string;
	readonly VITE_UI_LOCALES?: string;
	readonly VITE_AUDIENCES?: string;
	readonly VITE_SECRET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
