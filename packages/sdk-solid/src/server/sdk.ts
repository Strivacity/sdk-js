import type { SolidServerSDK, SolidServerSDKInitConfig, RequestEvent } from './types';
import { getRequestEvent, redirect } from '@solidjs/web';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';

/**
 * Resolves the Solid request event, falling back to the ambient `getRequestEvent()` when not explicitly provided.
 *
 * @param {RequestEvent} [event] - An explicit Solid request event.
 * @returns {RequestEvent | undefined} The resolved event, or `undefined` outside a request scope.
 */
function resolveEvent(event?: RequestEvent): RequestEvent | undefined {
	return event ?? (getRequestEvent() as RequestEvent | undefined);
}

/**
 * Creates the Strivacity server SDK for Solid's `@solidjs/vite-plugin` "start" mode: session management, auth route handlers, and the `middleware` used in `src/middleware.ts`.
 *
 * @param {SolidServerSDKInitConfig} initConfig - The configuration options for initializing the server SDK.
 * @returns {SolidServerSDK} The initialized server SDK instance.
 */
export function createServerSDK(initConfig: SolidServerSDKInitConfig): SolidServerSDK {
	const base = createBaseServerSDK<RequestEvent | undefined>(
		{
			toRequest: (event) => event!.request,
			redirect: (url, status) => redirect(url.toString(), status),
		},
		initConfig,
	);

	return {
		get options() {
			return base.options;
		},
		middleware: async (request, next) => {
			const event = resolveEvent();
			const response = event ? await base.handler(event) : null;

			return response ?? next(request);
		},
		getSession: (event) => base.getSession(resolveEvent(event)),
		updateSession: (session, event) => base.updateSession(session, resolveEvent(event)),
		refreshSession: (event) => base.refreshSession(resolveEvent(event)),
		revokeSession: (event) => base.revokeSession(resolveEvent(event)),
		getEntrySession: (entryUrl) => base.getEntrySession(entryUrl),
		completeLogin: (params, event) => base.completeLogin(params, resolveEvent(event)),
		logout: (postLogoutRedirectUri, event) => base.logout(postLogoutRedirectUri, resolveEvent(event)),
		handleLogin: (event) => base.handleLogin(resolveEvent(event)),
		handleRegister: (event) => base.handleRegister(resolveEvent(event)),
		handleCallback: (event) => base.handleCallback(resolveEvent(event)),
		handleRefresh: (event) => base.handleRefresh(resolveEvent(event)),
		handleRevoke: (event) => base.handleRevoke(resolveEvent(event)),
		handleEntry: (event) => base.handleEntry(resolveEvent(event)),
		handleLogout: (event) => base.handleLogout(resolveEvent(event)),
		handleBackChannelLogout: (event) => base.handleBackChannelLogout(resolveEvent(event)),
		handler: (event) => base.handler(resolveEvent(event)),
	};
}
