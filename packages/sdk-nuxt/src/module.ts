import type { SDKOptions } from '@strivacity/sdk-core';
import { defineNuxtModule, createResolver, addTemplate, addTypeTemplate, addImports, addComponent } from '@nuxt/kit';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import { HttpClient } from '@strivacity/sdk-core/utils/HttpClient';
import { DefaultLogging } from '@strivacity/sdk-core/utils/Logging';
import { LocalStorage } from '@strivacity/sdk-core/storages/LocalStorage';
import { SessionStorage } from '@strivacity/sdk-core/storages/SessionStorage';

declare module '@nuxt/schema' {
	interface PublicRuntimeConfig {
		strivacity: SDKOptions;
	}
}

export type ModuleOptions = SDKOptions;

export * from '@strivacity/sdk-core';
export { createCredential, getCredential } from '@strivacity/sdk-core/utils/credentials';
export type * from './types';
export type { PopupFlow, RedirectFlow, NativeFlow };
export { HttpClient, DefaultLogging, LocalStorage, SessionStorage };

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
	get(key: string): Promise<string | null>;
	delete(key: string): Promise<void>;
	set(key: string, value: string): Promise<void>;
}

export default CustomStorage`,
		});
		addTemplate({
			filename: 'strivacity-sdk-logging.mjs',
			getContents: () => `export default ${options.logging?.toString()}`,
		});
		addTypeTemplate({
			filename: 'strivacity-sdk-logging.d.ts',
			getContents: () => `
import type { SDKLogging } from '@strivacity/sdk-core';

declare class CustomLogging implements SDKLogging {
	xEventId: string | undefined;

	debug(message: string): void;
	info(message: string): void;
	warn(message: string): void;
	error(message: string, error: Error): void;
}

export default CustomLogging`,
		});
		addComponent({
			name: 'StyLoginRenderer',
			filePath: resolver.resolve('./runtime/login-renderer.vue'),
		});
		addImports({ name: 'useStrivacity', as: 'useStrivacity', from: resolver.resolve('./runtime/composables') });
		addImports({ name: 'getCredential', as: 'getCredential', from: resolver.resolve('./runtime/composables') });
		addImports({ name: 'createCredential', as: 'createCredential', from: resolver.resolve('./runtime/composables') });
	},
});
