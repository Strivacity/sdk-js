import { type ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { provideStrivacityServerSession } from '@strivacity/sdk-angular/server';
import { appConfig } from '../app/app.config';
import { serverRoutes } from './app.routes.server';
import { getServerSdk } from './strivacity';

const serverConfig: ApplicationConfig = {
	providers: [provideServerRendering(withRoutes(serverRoutes)), provideStrivacityServerSession(getServerSdk())],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
