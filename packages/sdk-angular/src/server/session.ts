import type { EnvironmentProviders } from '@angular/core';
import type { AngularServerSDK, SessionData } from './types';
import { REQUEST, TransferState, inject, makeStateKey, provideAppInitializer } from '@angular/core';

export const SESSION_TRANSFER_KEY = makeStateKey<SessionData | null>('sty.session');

/**
 * Loads the current session from the encrypted cookie storage (using Angular's `REQUEST` token) before the app
 * renders, and hands it over to the client through `TransferState`, so `StrivacityAuthService` can hydrate without
 * an extra round-trip or a loading flash.
 *
 * Add this to the server-only `ApplicationConfig` (e.g. `app.config.server.ts`), alongside `provideServerRendering()`.
 *
 * @param {AngularServerSDK | undefined} serverSdk - The server SDK instance created via `createServerSDK()`, or
 * `undefined` when server-side sessions aren't configured (a no-op in that case).
 * @returns {EnvironmentProviders} The providers to add to the server `ApplicationConfig`.
 */
export function provideStrivacityServerSession(serverSdk: AngularServerSDK | undefined): EnvironmentProviders {
	return provideAppInitializer(async () => {
		const request = inject(REQUEST);

		if (!request || !serverSdk) {
			return;
		}

		const transferState = inject(TransferState);
		const session = await serverSdk.getSession(request);

		transferState.set(SESSION_TRANSFER_KEY, session);
	});
}
