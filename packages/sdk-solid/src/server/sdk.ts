import type { SolidServerSDK, SolidServerSDKInitConfig, RequestEvent } from './types';
import { getRequestEvent, redirect } from '@solidjs/web';
import { flushSetCookies } from '@strivacity/sdk-core/utils';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';

const canonicalEvents = new WeakMap<Request, RequestEvent>();

/**
 * Solid calls a server function during SSR with a shallow copy of the request event, while the core tracks the once-per-request
 * refresh and the queued `Set-Cookie` headers per event object. Map every copy back to the first event seen for the request
 * (keyed by the `request` object, which all copies share), so server functions reuse the session `middleware` already refreshed
 * instead of refreshing again with the old refresh token, and `middleware` flushes the cookies they queue.
 *
 * @param {RequestEvent} [event] - The request event to canonicalize.
 * @returns {RequestEvent | undefined} The first event seen for the same request, or the given event.
 */
function canonical(event?: RequestEvent): RequestEvent | undefined {
	const key = event?.request;

	if (!key) {
		return event;
	}

	const known = canonicalEvents.get(key);

	if (known) {
		return known;
	}

	canonicalEvents.set(key, event);

	return event;
}

/**
 * Resolves the canonical Solid request event, falling back to the ambient `getRequestEvent()` when not explicitly provided.
 *
 * @param {RequestEvent} [event] - An explicit Solid request event.
 * @returns {RequestEvent | undefined} The resolved event, or `undefined` outside a request scope.
 */
function resolveEvent(event?: RequestEvent): RequestEvent | undefined {
	return canonical(event ?? (getRequestEvent() as RequestEvent | undefined));
}

/**
 * Whether the request asks for an HTML page (a document navigation), as opposed to an asset, API or server-function request.
 *
 * @param {Request} request - The incoming request.
 * @returns {boolean} `true` for `GET` requests that accept `text/html`.
 */
function isPageRequest(request: Request): boolean {
	return request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html');
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

	// NOTE: middleware, server functions and rendering resolve to one canonical request event, so they share the core's
	// once-per-request refresh (`getSession`); `middleware` refreshes before rendering and writes the rotated cookie.

	return {
		get options() {
			return base.options;
		},
		middleware: async (request, next) => {
			const event = resolveEvent();

			if (!event) {
				base.options.logging?.warn('No request event available, auth routes are not handled for this request');
			}

			const response = event ? await base.handler(event) : null;

			if (response) {
				return response;
			}

			// NOTE: pages are rendered with renderToStream, so the response headers are sent before a session read inside a
			// <Loading> boundary finishes: refresh here, while the rotated cookie can still be set. The render then reads the
			// same refreshed session from the core's per-request cache instead of refreshing again with the old refresh token.
			// Only page requests refresh up front: the browser sends other requests (favicon, assets, devtools probes) in parallel
			// with the page, and refreshing with the same refresh token in each of them would invalidate the session.
			if (event && isPageRequest(request)) {
				await base.getSession(event).catch(() => null);
			}

			const nextResponse = await next(request);

			return event ? flushSetCookies(event, nextResponse) : nextResponse;
		},
		getSession: (event, params) => base.getSession(resolveEvent(event), params),
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
