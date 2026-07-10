import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import type { SDKOptions } from '@strivacity/sdk-angular';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideStrivacity, createDefaultLogging } from '@strivacity/sdk-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes),
		provideClientHydration(withEventReplay()),
		provideStrivacity({
			mode: (import.meta.env?.VITE_MODE as SDKOptions['mode']) ?? 'redirect',
			issuer: import.meta.env?.VITE_ISSUER as SDKOptions['issuer'],
			clientId: import.meta.env?.VITE_CLIENT_ID as SDKOptions['clientId'],
			scopes: import.meta.env?.VITE_SCOPES?.split(' ') as SDKOptions['scopes'],
			redirectUri: import.meta.env?.VITE_REDIRECT_URI as SDKOptions['redirectUri'],
			storageTokenName: 'sty.session.angular',
			serverSideSession: true,
			logging: createDefaultLogging(),
		}),
	],
};
