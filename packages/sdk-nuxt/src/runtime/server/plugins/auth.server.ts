import type { H3Event } from 'h3';
import type { NitroApp } from 'nitropack/types';
import type { NuxtServerSDK, NuxtServerSDKInitConfig } from '../../types';
import { toWebRequest, createError } from 'h3';
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

type BaseSDK = ReturnType<typeof createBaseServerSDK<H3Event>>;

export default defineNitroPlugin((nitroApp: NitroApp) => {
	let base: BaseSDK | undefined;
	let setupError: unknown;

	const ready = setupAuthPlugin()
		.then((result) => {
			base = result;
		})
		.catch((error: unknown) => {
			// NOTE: Nitro calls plugins synchronously and never awaits or catches their result, so a rejection
			// here would otherwise be a silent unhandled rejection. Logging it and falling back to a stub sdk
			// below turns every request into a clear 500 instead of an unrelated "sdk is undefined" error.
			// eslint-disable-next-line no-console
			console.error('[@strivacity/sdk-nuxt] Failed to initialize the Strivacity server SDK:', error);
			setupError = error;
		});

	// NOTE: Registered synchronously, before setupAuthPlugin's awaited dynamic imports resolve, so even the
	// very first request right after startup is covered by it - the hook itself just awaits `ready` first.
	nitroApp.hooks.hook('request', async (event: H3Event) => {
		await ready;

		event.context.strivacity ??= {} as never;

		if (event.context.strivacity.sdk) {
			return;
		}

		if (!base) {
			event.context.strivacity.sdk = new Proxy({} as NuxtServerSDK, {
				get: () => {
					throw createError({ statusCode: 500, statusMessage: 'Strivacity SDK failed to initialize', cause: setupError });
				},
			});
			return;
		}

		const sdk = base;

		event.context.strivacity.sdk = {
			get options() {
				return sdk.options;
			},
			getSession: (_event, params) => sdk.getSession(event, params),
			updateSession: (session) => sdk.updateSession(session, event),
			refreshSession: () => sdk.refreshSession(event),
			revokeSession: () => sdk.revokeSession(event),
			getEntrySession: (entryUrl) => sdk.getEntrySession(entryUrl),
			completeLogin: (params) => sdk.completeLogin(params, event),
			logout: (postLogoutRedirectUri) => sdk.logout(postLogoutRedirectUri, event),
			handleLogin: (evt) => sdk.handleLogin(evt),
			handleRegister: (evt) => sdk.handleRegister(evt),
			handleCallback: (evt) => sdk.handleCallback(evt),
			handleRefresh: (evt) => sdk.handleRefresh(evt),
			handleRevoke: (evt) => sdk.handleRevoke(evt),
			handleEntry: (evt) => sdk.handleEntry(evt),
			handleLogout: (evt) => sdk.handleLogout(evt),
			handleBackChannelLogout: (evt) => sdk.handleBackChannelLogout(evt),
			handler: (evt) => sdk.handler(evt),
		};
	});
});

async function setupAuthPlugin(): Promise<BaseSDK> {
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
		if (!initConfig.cookieSecret) {
			throw new ConfigurationError('Missing SDK option: cookieSecret');
		}

		initConfig.cookieMaxAge ??= 30 * 24 * 60 * 60;
		initConfig.storage = createEncryptedCookieStorage(initConfig.cookieSecret, { defaultCookieOptions: { maxAge: initConfig.cookieMaxAge } });
	}

	return createBaseServerSDK<H3Event>(
		{
			toRequest: (event) => toWebRequest(event),
		},
		initConfig,
	);
}
