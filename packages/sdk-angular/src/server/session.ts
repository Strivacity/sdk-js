import type { EnvironmentProviders } from '@angular/core';
import type { AngularServerSDK, SessionData } from './types';
import { REQUEST, RESPONSE_INIT, TransferState, inject, makeStateKey, provideAppInitializer } from '@angular/core';
import { flushSetCookies, toClientSession } from '@strivacity/sdk-core/utils';

export const SESSION_TRANSFER_KEY = makeStateKey<SessionData | null>('sty.session');

/**
 * Loads the current session from the encrypted cookie storage (using Angular's `REQUEST` token) before the app
 * renders, and hands it over to the client through `TransferState` (without the refresh and ID tokens, which stay server-side), so `StrivacityAuthService` can hydrate without
 * an extra round-trip or a loading flash.
 *
 * Add this to the server-only `ApplicationConfig` (e.g. `app.config.server.ts`), alongside `provideServerRendering()`.
 *
 * @param {AngularServerSDK | undefined} serverSdk - The server SDK instance created via `createServerSDK()`, or `undefined` when server-side sessions aren't configured (a no-op in that case).
 * @returns {EnvironmentProviders} The providers to add to the server `ApplicationConfig`.
 */
export function provideStrivacityServerSession(serverSdk: AngularServerSDK | undefined): EnvironmentProviders {
	return provideAppInitializer(async () => {
		const request = inject(REQUEST);

		if (!request || !serverSdk) {
			return;
		}

		const transferState = inject(TransferState);
		const responseInit = inject(RESPONSE_INIT, { optional: true });

		const session = await serverSdk.getSession(request);
		const cookies = flushSetCookies(request, new Response(null)).headers.getSetCookie();

		if (responseInit && cookies.length) {
			const headers = new Headers(responseInit.headers);

			for (const cookie of cookies) {
				headers.append('set-cookie', cookie);
			}

			responseInit.headers = headers;
		}

		transferState.set(SESSION_TRANSFER_KEY, toClientSession(session));
	});
}
