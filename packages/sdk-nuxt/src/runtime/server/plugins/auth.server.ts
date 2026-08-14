import type { H3Event } from 'h3';
import type { NitroApp } from 'nitropack/types';
import type { NuxtServerSDK, NuxtServerSDKOptions, NuxtServerSDKInitConfig } from '../../types';
import { useRuntimeConfig } from '#imports';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import { getDefaultFlowState, getSDKOptions } from '@strivacity/sdk-core/utils/oidc';
import { createServerStateStorage, getEncryptedCookieStorage } from '../storages/default';

declare module 'h3' {
	interface H3EventContext {
		strivacity: {
			options: NuxtServerSDKOptions;
			sdk: NuxtServerSDK;
		};
	}
}

export default defineNitroPlugin((nitroApp) => {
	void setupAuthPlugin(nitroApp);
});

async function setupAuthPlugin(nitroApp: NitroApp) {
	const config = useRuntimeConfig();
	const opts = { ...config.strivacity } as NuxtServerSDKInitConfig;
	const customStorage = (await import('#strivacity-options-storage')).default();
	const customStateStorage = (await import('#strivacity-options-stateStorage')).default();
	const customLogging = (await import('#strivacity-options-logging')).default();
	const customHttpClient = (await import('#strivacity-options-httpClient')).default();

	if (customStorage) {
		opts.storage = customStorage;
	}
	if (customStateStorage) {
		opts.stateStorage = customStateStorage;
	}
	if (customLogging) {
		opts.logging = customLogging;
	}
	if (customHttpClient) {
		opts.httpClient = customHttpClient;
	}

	if (!opts.issuer) {
		throw new Error('Missing Strivacity SDK option: issuer');
	}
	if (!opts.clientId) {
		throw new Error('Missing Strivacity SDK option: clientId');
	}
	if (!opts.redirectUri) {
		throw new Error('Missing Strivacity SDK option: redirectUri');
	}
	if (opts.scopes && !Array.isArray(opts.scopes)) {
		throw new Error('Invalid Strivacity SDK option: scopes');
	}
	if (!opts.postLoginRedirectUri) {
		opts.postLoginRedirectUri = new URL(opts.redirectUri).origin;
	}
	if (!opts.postLogoutRedirectUri) {
		opts.postLogoutRedirectUri = new URL(opts.redirectUri).origin;
	}
	if (!opts.cookieMaxAge) {
		opts.cookieMaxAge = 30 * 24 * 60 * 60;
	}
	if (!opts.storage) {
		if (!opts.secret) {
			throw new Error('Secret is required for encrypted cookie storage');
		}

		opts.storage = getEncryptedCookieStorage(opts.secret, { maxAge: opts.cookieMaxAge });
	}
	if (!opts.stateStorage) {
		opts.stateStorage = createServerStateStorage();
	}
	if (!opts.urlHandler) {
		opts.urlHandler = async () => Promise.resolve(undefined);
	}
	if (!opts.authUrlPrefix) {
		opts.authUrlPrefix = '/auth';
	}

	nitroApp.hooks.hook('request', (event: H3Event) => {
		event.context.strivacity ??= {} as never;
		event.context.strivacity.options ??= getSDKOptions<NuxtServerSDKOptions>(getDefaultFlowState(), opts);
	});
}
