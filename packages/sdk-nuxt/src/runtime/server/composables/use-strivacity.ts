import type { H3Event } from 'h3';
import type { SessionData } from '@strivacity/sdk-core/types';
import type { NuxtServerSDK } from '../../types';
import { loadSession, serializeSession } from '@strivacity/sdk-core/utils/session';
import { buildEndSessionUrl, revokeToken, refreshToken, exchangeCode, fetchFlowEntry } from '@strivacity/sdk-core/utils/oidc';

let instance: NuxtServerSDK | undefined;

function createServerSDK(event: H3Event): NuxtServerSDK {
	const options = event.context.strivacity.options;

	// region session management

	async function getSession(): Promise<SessionData | null> {
		return loadSession(await options.storage.get(options.storageTokenName, event));
	}

	async function updateSession(session: SessionData): Promise<void> {
		await options.storage.set(options.storageTokenName, serializeSession(session), event);
	}

	async function refreshSession(): Promise<SessionData> {
		options.logging?.debug('Attempting to refresh session');

		const currentSession = await getSession();

		if (typeof currentSession?.refresh_token !== 'string') {
			throw new Error('No refresh token available');
		}

		try {
			const newSession = await refreshToken({ refreshToken: currentSession.refresh_token, options });
			await options.storage.set(options.storageTokenName, serializeSession(newSession), event);

			options.logging?.debug('Session refresh successful');

			return newSession;
		} catch (error) {
			await options.storage.delete(options.storageTokenName, event);
			options.logging?.error('Session refresh failed', error as Error);
			throw error;
		}
	}

	async function revokeSession(): Promise<void> {
		const currentSession = await getSession();
		const tokenTypeHint = currentSession?.refresh_token ? 'refresh_token' : 'access_token';
		const token = currentSession?.refresh_token ?? currentSession?.access_token ?? null;

		await options.storage.delete(options.storageTokenName, event);

		if (!token) {
			options.logging?.debug('Revoke called without session');
			return;
		}

		try {
			await revokeToken({ tokenTypeHint, token, options });
			options.logging?.info(`${tokenTypeHint === 'refresh_token' ? 'Refresh' : 'Access'} token successfully revoked`);
		} catch (error) {
			options.logging?.error('Token revocation failed', error as Error);
			throw error;
		}
	}

	async function getEntrySession(entryUrl: string | URL): Promise<Record<string, string>> {
		const { searchParams: params } = new URL(entryUrl);

		options.logging?.debug('Attempting entry request');

		try {
			const url = new URL('/provider/flow/entry', options.issuer);
			const data = await fetchFlowEntry({
				url,
				params,
				sdkMode: options.mode === 'embedded' ? 'web-embedded' : 'web',
				options,
			});

			options.logging?.debug(`Entry request successful - ${JSON.stringify(data)}`);

			return data;
		} catch (error) {
			options.logging?.error('Entry request failed', error as Error);
			throw error;
		}
	}

	async function completeLogin(params: Record<string, string>): Promise<SessionData> {
		options.logging?.debug('Exchanging authorization code for tokens');

		try {
			const session = await exchangeCode({ params, options });
			await options.storage.set(options.storageTokenName, serializeSession(session), event);

			options.logging?.debug('Token exchange successful');

			if (session.access_token && options.logging) {
				options.logging.xEventId = undefined;
				options.logging.info('Login successful');
			}

			return session;
		} catch (error) {
			options.logging?.error('Token exchange failed', error as Error);
			throw error;
		}
	}

	async function logout(postLogoutRedirectUri: string | URL): Promise<URL> {
		options.logging?.debug('Attempting to logout');

		const currentSession = await getSession();
		await options.storage.delete(options.storageTokenName, event);

		options.logging?.debug('Logout initiated');

		if (!currentSession?.id_token) {
			options.logging?.debug('Logout called without session');
			return new URL(postLogoutRedirectUri);
		}

		return buildEndSessionUrl({
			url: (await options.getMetadata()).end_session_endpoint,
			idToken: currentSession.id_token,
			postLogoutRedirectUri: new URL(postLogoutRedirectUri).toString(),
		});
	}

	// endregion

	return {
		getSession,
		updateSession,
		refreshSession,
		revokeSession,
		getEntrySession,
		completeLogin,
		logout,
	};
}

export const useStrivacity = (event: H3Event) => {
	if (import.meta.client) {
		throw new Error('The "useStrivacity" composable should only be used on the server.');
	}

	if (!event) {
		throw new Error('useStrivacity() can not be called without passing an H3Event instance.');
	}

	event.context.strivacity ??= {} as never;
	event.context.strivacity.sdk ??= createServerSDK(event);
	instance = event.context.strivacity.sdk;

	return instance;
};
