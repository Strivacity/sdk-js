import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStrivacity } from '@strivacity/sdk-angular';
import { routes } from './app.routes';

interface ImportMeta {
	env: {
		VITE_ISSUER: string;
		VITE_SCOPES: string;
		VITE_CLIENT_ID: string;
	};
}

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(routes),
		provideStrivacity({
			mode: 'redirect',
			issuer: (import.meta as unknown as ImportMeta).env.VITE_ISSUER,
			scopes: (import.meta as unknown as ImportMeta).env.VITE_SCOPES.split(' '),
			clientId: (import.meta as unknown as ImportMeta).env.VITE_CLIENT_ID,
			redirectUri: 'http://localhost:4200/callback',
			storageTokenName: 'sty.session.angular',
		}),
	],
};
