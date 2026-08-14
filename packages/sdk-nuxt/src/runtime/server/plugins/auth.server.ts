import type { H3Event } from 'h3';
import type { NitroApp } from 'nitropack/types';
import type { NuxtServerSDK, NuxtServerSDKInitConfig } from '../../types';
import { toWebRequest } from 'h3';
import { useRuntimeConfig } from '#imports';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { ConfigurationError } from '@strivacity/sdk-core/utils';
import { createEncryptedCookieStorage } from '../../storages/default';

declare module 'h3' {
	interface H3EventContext {
		strivacity: {
			sdk: NuxtServerSDK;
		};
	}
}

export default defineNitroPlugin((nitroApp) => {
	void setupAuthPlugin(nitroApp);
});

async function setupAuthPlugin(nitroApp: NitroApp) {
	const config = useRuntimeConfig();
	const initConfig = { ...config.strivacity } as NuxtServerSDKInitConfig;
	const customStorage = (await import('#strivacity-options-storage')).default();
	const customStateStorage = (await import('#strivacity-options-stateStorage')).default();
	const customLogging = (await import('#strivacity-options-logging')).default();
	const customHttpClient = (await import('#strivacity-options-httpClient')).default();

	if (customStorage) {
		initConfig.storage = customStorage;
	}
	if (customStateStorage) {
		initConfig.stateStorage = customStateStorage;
	}
	if (customLogging) {
		initConfig.logging = customLogging;
	}
	if (customHttpClient) {
		initConfig.httpClient = customHttpClient;
	}

	if (!initConfig.storage) {
		if (!initConfig.secret) {
			throw new ConfigurationError('Secret is required for encrypted cookie storage');
		}

		initConfig.cookieMaxAge ??= 30 * 24 * 60 * 60;
		initConfig.storage = createEncryptedCookieStorage(initConfig.secret, { defaultCookieOptions: { maxAge: initConfig.cookieMaxAge } });
	}

	const base = createBaseServerSDK<H3Event>(
		{
			toRequest: (event) => toWebRequest(event),
		},
		initConfig,
	);

	nitroApp.hooks.hook('request', (event: H3Event) => {
		event.context.strivacity ??= {} as never;
		event.context.strivacity.sdk ??= {
			get options() {
				return base.options;
			},
			getSession: () => base.getSession(event),
			updateSession: (session) => base.updateSession(session, event),
			refreshSession: () => base.refreshSession(event),
			revokeSession: () => base.revokeSession(event),
			getEntrySession: (entryUrl) => base.getEntrySession(entryUrl),
			completeLogin: (params) => base.completeLogin(params, event),
			logout: (postLogoutRedirectUri) => base.logout(postLogoutRedirectUri, event),
			handleLogin: (evt) => base.handleLogin(evt),
			handleRegister: (evt) => base.handleRegister(evt),
			handleCallback: (evt) => base.handleCallback(evt),
			handleRefresh: (evt) => base.handleRefresh(evt),
			handleRevoke: (evt) => base.handleRevoke(evt),
			handleEntry: (evt) => base.handleEntry(evt),
			handleLogout: (evt) => base.handleLogout(evt),
			handleBackChannelLogout: (evt) => base.handleBackChannelLogout(evt),
			handler: (evt) => base.handler(evt),
		};
	});
}
