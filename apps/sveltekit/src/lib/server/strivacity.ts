import type { SvelteKitServerSDKInitConfig } from '@strivacity/sdk-svelte/server';
import { createServerSDK, createDefaultLogging } from '@strivacity/sdk-svelte/server';
import { sdkOptions } from '../options';

let serverSdk: ReturnType<typeof createServerSDK> | undefined;

/**
 * Lazily creates the server SDK singleton. Kept lazy so that a build/route-introspection pass without real env vars doesn't crash.
 */
export function getServerSdk() {
	serverSdk ??= createServerSDK({
		...(sdkOptions as SvelteKitServerSDKInitConfig),
		logging: createDefaultLogging(),
		secret: import.meta.env.VITE_SECRET,
	});

	return serverSdk;
}
