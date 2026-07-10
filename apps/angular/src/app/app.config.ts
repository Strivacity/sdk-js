import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideStrivacity } from '@strivacity/sdk-angular';
import { routes } from './app.routes';
import { baseSdkOptions } from '../options';

export const appConfig: ApplicationConfig = {
	providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes), provideClientHydration(withEventReplay()), provideStrivacity(baseSdkOptions)],
};
