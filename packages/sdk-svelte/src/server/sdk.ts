import type { RequestEvent, Handle } from '@sveltejs/kit';
import type { SessionData } from '@strivacity/sdk-core/types';
import type { SvelteKitServerSDK, SvelteKitServerSDKInitConfig } from './types';
import { redirect } from '@sveltejs/kit';
import { flushSetCookies } from '@strivacity/sdk-core/utils';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';

const canonicalEvents = new WeakMap<object, RequestEvent>();

/**
 * SvelteKit hands shallow copies of the request event to `load`, `resolve()` and each `sequence()` handler, while the core tracks queued `Set-Cookie` headers per event object.
 * Map every copy back to the first event seen for the request (keyed by the `locals` object, which all copies share) so cookies queued from `load` / `+server.ts` are flushed by `handle`.
 *
 * @template T - The type of the request event, typically `RequestEvent` or `undefined`.
 * @param event - The request event to canonicalize.
 * @returns The canonical request event, which may be the same as the input or a previously seen event.
 */
function canonical<T extends RequestEvent | undefined>(event: T): T {
	const key = event?.locals;

	if (!key) {
		return event;
	}

	const known = canonicalEvents.get(key);

	if (known) {
		return known as T;
	}

	canonicalEvents.set(key, event);

	return event;
}

/**
 * Creates the Strivacity server SDK for SvelteKit: session management, auth route handlers, and the `handle` hook used in `hooks.server.ts`.
 *
 * @param {SvelteKitServerSDKInitConfig} initConfig - The configuration options for initializing the server SDK.
 * @returns {SvelteKitServerSDK} The initialized server SDK instance.
 */
export function createServerSDK(initConfig: SvelteKitServerSDKInitConfig): SvelteKitServerSDK {
	const base = createBaseServerSDK<RequestEvent>(
		{
			toRequest: (event) => event.request,
		},
		initConfig,
	);

	// NOTE: SvelteKit runs the layout and page `load` functions concurrently, each with its own event copy: the canonical event makes
	// them share the core's once-per-request refresh (`getSession`), and `handle` writes the rotated cookie.
	async function requireSession(requestEvent: RequestEvent, guardOpts: { returnTo?: string } = {}): Promise<SessionData> {
		const event = canonical(requestEvent);
		const session = await base.getSession(event);

		if (!session) {
			const loginUrl = ['embedded', 'native'].includes(base.options.mode) ? base.options.loginPageUri : `${base.options.authUriPrefix}/login`;
			const uri = new URL(loginUrl, event.url.origin);
			const returnTo = guardOpts.returnTo ?? `${event.url.pathname}${event.url.search}`;

			if (returnTo) {
				uri.searchParams.set('returnTo', returnTo);
			}

			redirect(302, uri);
		}

		return session;
	}

	const handle: Handle = async ({ event, resolve }) => {
		const requestEvent = canonical(event);
		const response = await base.handler(requestEvent);

		return response ?? flushSetCookies(requestEvent, await resolve(event));
	};

	return {
		get options() {
			return base.options;
		},
		handle,
		requireSession,
		getSession: (event, params) => base.getSession(canonical(event), params),
		updateSession: (session, event) => base.updateSession(session, canonical(event)),
		refreshSession: (event) => base.refreshSession(canonical(event)),
		revokeSession: (event) => base.revokeSession(canonical(event)),
		getEntrySession: (entryUrl) => base.getEntrySession(entryUrl),
		completeLogin: (params, event) => base.completeLogin(params, canonical(event)),
		logout: (postLogoutRedirectUri, event) => base.logout(postLogoutRedirectUri, canonical(event)),
		handleLogin: (event) => base.handleLogin(canonical(event)),
		handleRegister: (event) => base.handleRegister(canonical(event)),
		handleCallback: (event) => base.handleCallback(canonical(event)),
		handleRefresh: (event) => base.handleRefresh(canonical(event)),
		handleRevoke: (event) => base.handleRevoke(canonical(event)),
		handleEntry: (event) => base.handleEntry(canonical(event)),
		handleLogout: (event) => base.handleLogout(canonical(event)),
		handleBackChannelLogout: (event) => base.handleBackChannelLogout(canonical(event)),
		handler: (event) => base.handler(canonical(event)),
	};
}
