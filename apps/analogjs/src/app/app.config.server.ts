import { type ApplicationConfig, mergeApplicationConfig, REQUEST, inject } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { REQUEST as ANALOG_REQUEST } from '@analogjs/router/tokens';
import { provideStrivacityServerSession } from '@strivacity/sdk-angular/server';

import { appConfig } from './app.config';
import { getServerSdk } from '../server/strivacity';

const serverConfig: ApplicationConfig = {
	providers: [
		provideServerRendering(),
		// NOTE: AnalogJS provides its own `REQUEST` token (`@analogjs/router/tokens`, a raw Node `IncomingMessage`),
		// not Angular core's `REQUEST` (populated only by `@angular/ssr`, which AnalogJS's renderer doesn't use).
		// Bridge the two so `provideStrivacityServerSession` (which reads Angular core's `REQUEST`) can find the
		// current cookie session - `getSession()` only reads `req.headers.cookie`, so no conversion is needed.
		{ provide: REQUEST, useFactory: () => inject(ANALOG_REQUEST) as unknown as globalThis.Request },
		provideStrivacityServerSession(getServerSdk()),
	],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
