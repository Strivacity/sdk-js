import type { NuxtServerSDKInitConfig } from './runtime/types';
import {
	defineNuxtModule,
	resolvePath,
	createResolver,
	addImportsDir,
	addServerImportsDir,
	addServerHandler,
	addServerPlugin,
	addRouteMiddleware,
} from '@nuxt/kit';

export type * from './runtime/types';

export default defineNuxtModule<NuxtServerSDKInitConfig>({
	meta: {
		name: '@strivacity/sdk-nuxt',
		configKey: 'strivacity',
	},
	setup: async (options, nuxt) => {
		const resolver = createResolver(import.meta.url);

		if (typeof options.serverSideSession === 'undefined') {
			options.serverSideSession = true;
		}
		if (!options.authUrlPrefix) {
			options.authUrlPrefix = '/auth';
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { secret, storageFactoryPath, stateStorageFactoryPath, loggingFactoryPath, httpClientFactoryPath, ...publicOptions } = options;
		const noop = resolver.resolve('./runtime/utils/noop');

		nuxt.options.runtimeConfig.strivacity = options as never;
		nuxt.options.runtimeConfig.public.strivacity = publicOptions as never;
		nuxt.options.alias = nuxt.options.alias || {};
		nuxt.options.nitro.alias = nuxt.options.nitro.alias || {};

		const loggingPath = options.loggingFactoryPath ? await resolvePath(options.loggingFactoryPath) : noop;
		const httpClientPath = options.httpClientFactoryPath ? await resolvePath(options.httpClientFactoryPath) : noop;
		const storagePath = options.storageFactoryPath ? await resolvePath(options.storageFactoryPath) : noop;
		const stateStoragePath = options.stateStorageFactoryPath ? await resolvePath(options.stateStorageFactoryPath) : noop;

		nuxt.options.alias['#strivacity-options-logging'] = loggingPath;
		nuxt.options.alias['#strivacity-options-httpClient'] = httpClientPath;
		nuxt.options.nitro.alias['#strivacity-options-logging'] = loggingPath;
		nuxt.options.nitro.alias['#strivacity-options-httpClient'] = httpClientPath;
		nuxt.options.nitro.alias['#strivacity-options-storage'] = storagePath;
		nuxt.options.nitro.alias['#strivacity-options-stateStorage'] = stateStoragePath;

		addImportsDir(resolver.resolve('./runtime/composables'));
		addImportsDir(resolver.resolve('./runtime/storages'));
		addImportsDir(resolver.resolve('./runtime/utils'));

		addServerImportsDir(resolver.resolve('./runtime/server/composables'));
		addServerImportsDir(resolver.resolve('./runtime/server/storages'));
		addServerImportsDir(resolver.resolve('./runtime/server/utils'));

		addServerPlugin(resolver.resolve('./runtime/server/plugins/auth.server'));
		addRouteMiddleware({ name: 'strivacity', path: resolver.resolve('./runtime/middleware/auth.server'), global: true });

		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/login`,
			handler: resolver.resolve('./runtime/server/api/auth/login.get'),
		});
		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/login/session`,
			handler: resolver.resolve('./runtime/server/api/auth/login-session.get'),
		});
		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/register`,
			handler: resolver.resolve('./runtime/server/api/auth/register.get'),
		});
		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/callback`,
			handler: resolver.resolve('./runtime/server/api/auth/callback.get'),
		});
		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/refresh`,
			handler: resolver.resolve('./runtime/server/api/auth/refresh.get'),
		});
		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/revoke`,
			handler: resolver.resolve('./runtime/server/api/auth/revoke.get'),
		});
		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/entry`,
			handler: resolver.resolve('./runtime/server/api/auth/entry.get'),
		});
		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/logout`,
			handler: resolver.resolve('./runtime/server/api/auth/logout.get'),
		});
		addServerHandler({
			method: 'get',
			route: `${options.authUrlPrefix}/backchannel-logout`,
			handler: resolver.resolve('./runtime/server/api/auth/backchannel-logout.get'),
		});
	},
});
