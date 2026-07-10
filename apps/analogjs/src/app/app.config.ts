import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import type { SDKOptions } from '@strivacity/sdk-angular';
import { provideFileRouter, requestContextInterceptor } from '@analogjs/router';
import { provideStrivacity, createDefaultLogging } from '@strivacity/sdk-angular';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideFileRouter(),
		provideHttpClient(withInterceptors([requestContextInterceptor])),
		// NOTE: `provideClientHydration()` triggers a server-side `window is not defined` crash under AnalogJS's raw
		// `@angular/platform-server` `renderApplication()` pipeline (unlike `@angular/ssr`) - omitted, so the client does
		// a plain (non-hydrated) bootstrap on top of the server-rendered HTML. Pre-existing scaffold limitation, not caused by sdk-angular.
		provideStrivacity({
			mode: (import.meta.env?.VITE_MODE as SDKOptions['mode']) ?? 'redirect',
			issuer: import.meta.env?.VITE_ISSUER as SDKOptions['issuer'],
			clientId: import.meta.env?.VITE_CLIENT_ID as SDKOptions['clientId'],
			scopes: import.meta.env?.VITE_SCOPES?.split(' ') as SDKOptions['scopes'],
			redirectUri: import.meta.env?.VITE_REDIRECT_URI as SDKOptions['redirectUri'],
			storageTokenName: 'sty.session.analogjs',
			serverSideSession: true,
			logging: createDefaultLogging(),
		}),
	],
};
