import type { RequestEvent, Handle } from '@sveltejs/kit';
import type { SessionData } from '@strivacity/sdk-core/types';
import type { SvelteKitServerSDK, SvelteKitServerSDKInitConfig } from './types';
import { redirect } from '@sveltejs/kit';
import { isSessionExpired } from '@strivacity/sdk-core/utils';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';

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

	async function requireSession(event: RequestEvent, guardOpts: { returnTo?: string } = {}): Promise<SessionData> {
		let session = await base.getSession(event);

		if (session && isSessionExpired(session) && session.refresh_token) {
			try {
				session = await base.refreshSession(event);
			} catch {
				session = null;
			}
		}

		if (!session) {
			const loginUrl = ['embedded', 'native'].includes(base.options.mode) ? base.options.loginUri : `${base.options.authUrlPrefix}/login`;
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
		const response = await base.handler(event);

		return response ?? resolve(event);
	};

	return {
		get options() {
			return base.options;
		},
		handle,
		requireSession,
		getSession: (event) => base.getSession(event),
		updateSession: (session, event) => base.updateSession(session, event),
		refreshSession: (event) => base.refreshSession(event),
		revokeSession: (event) => base.revokeSession(event),
		getEntrySession: (entryUrl) => base.getEntrySession(entryUrl),
		completeLogin: (params, event) => base.completeLogin(params, event),
		logout: (postLogoutRedirectUri, event) => base.logout(postLogoutRedirectUri, event),
		handleLogin: (event) => base.handleLogin(event),
		handleRegister: (event) => base.handleRegister(event),
		handleCallback: (event) => base.handleCallback(event),
		handleRefresh: (event) => base.handleRefresh(event),
		handleRevoke: (event) => base.handleRevoke(event),
		handleEntry: (event) => base.handleEntry(event),
		handleLogout: (event) => base.handleLogout(event),
		handleBackChannelLogout: (event) => base.handleBackChannelLogout(event),
		handler: (event) => base.handler(event),
	};
}
