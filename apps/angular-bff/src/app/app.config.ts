import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStrivacity, DefaultLogging } from '@strivacity/sdk-angular';
import { routes } from './app.routes';
import { CustomNativeFlow } from './sdk/CustomNativeFlow';
import { CustomEmbeddedFlow } from './sdk/CustomEmbeddedFlow';

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

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(routes),
		provideStrivacity({
			mode: 'custom',
			issuer: (import.meta as unknown as ImportMeta).env.VITE_ISSUER,
			scopes: (import.meta as unknown as ImportMeta).env.VITE_SCOPES.split(' '),
			clientId: (import.meta as unknown as ImportMeta).env.VITE_CLIENT_ID,
			redirectUri: (import.meta as unknown as ImportMeta).env.VITE_REDIRECT_URI,
			storageTokenName: 'sty.session.angular',
			logging: DefaultLogging,
			customFlow: (import.meta as unknown as ImportMeta).env.VITE_MODE === 'native' ? CustomNativeFlow : CustomEmbeddedFlow,
		}),
	],
};
