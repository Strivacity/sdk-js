import type { SDKOptions, SDKStorage, IdTokenClaims } from '@strivacity/sdk-core';
import { defineNuxtModule, createResolver, addTemplate, addTypeTemplate, addImports } from '@nuxt/kit';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { LocalStorage } from '@strivacity/sdk-core/storages/LocalStorage';
import { SessionStorage } from '@strivacity/sdk-core/storages/SessionStorage';
import type { Session, PopupContext, PopupSDK, RedirectContext, RedirectSDK } from './types';

declare module '@nuxt/schema' {
	interface PublicRuntimeConfig {
		strivacity: SDKOptions;
	}
}

export type ModuleOptions = SDKOptions;

export type { SDKOptions, SDKStorage, Session, IdTokenClaims, PopupFlow, RedirectFlow, PopupContext, RedirectContext, PopupSDK, RedirectSDK };
export { LocalStorage, SessionStorage };

export default defineNuxtModule<ModuleOptions>({
	meta: {
		name: '@strivacity/sdk-nuxt',
		configKey: 'strivacity',
	},
	defaults: {} as SDKOptions,
	setup(options, nuxt) {
		const resolver = createResolver(import.meta.url);

		nuxt.options.runtimeConfig.public.strivacity = options;

		addTemplate({
			filename: 'strivacity-sdk-storage.mjs',
			getContents: () => `export default ${options.storage ? options.storage.toString() : LocalStorage.toString()}`,
		});
		addTypeTemplate({
			filename: 'strivacity-sdk-storage.d.ts',
			getContents: () => `
import type { SDKStorage } from '@strivacity/sdk-core';

declare class CustomStorage implements SDKStorage {
	get(key: string): string | null;
	delete(key: string): void;
	set(key: string, value: string): void;
}

export default CustomStorage`,
		});
		addImports({ name: 'useStrivacity', as: 'useStrivacity', from: resolver.resolve('./runtime/composables') });
	},
});
