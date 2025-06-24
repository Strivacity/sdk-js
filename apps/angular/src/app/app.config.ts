import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStrivacity } from '@strivacity/sdk-angular';
import { routes } from './app.routes';

interface ImportMeta {
	env: {
		VITE_MODE: 'redirect' | 'popup' | 'native';
		VITE_ISSUER: string;
		VITE_SCOPES: string;
		VITE_CLIENT_ID: string;
		VITE_REDIRECT_URI: string;
	};
}

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(routes),
		provideStrivacity({
			mode: (import.meta as unknown as ImportMeta).env.VITE_MODE,
			issuer: (import.meta as unknown as ImportMeta).env.VITE_ISSUER,
			scopes: (import.meta as unknown as ImportMeta).env.VITE_SCOPES.split(' '),
			clientId: (import.meta as unknown as ImportMeta).env.VITE_CLIENT_ID,
			redirectUri: (import.meta as unknown as ImportMeta).env.VITE_REDIRECT_URI,
			storageTokenName: 'sty.session.angular',
		}),
	],
};
