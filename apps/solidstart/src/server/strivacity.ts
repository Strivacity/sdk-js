import type { SolidServerSDKInitConfig } from '@strivacity/sdk-solid/server';
import { createServerSDK, createDefaultLogging } from '@strivacity/sdk-solid/server';
import { sdkOptions } from '../options';

let serverSdk: ReturnType<typeof createServerSDK> | undefined;

/**
 * Lazily creates the server SDK singleton. Kept lazy so that a build/route-introspection pass without real env vars doesn't crash.
 */
export function getServerSdk() {
	serverSdk ??= createServerSDK({
		...(sdkOptions as SolidServerSDKInitConfig),
		logging: createDefaultLogging(),
		postLoginRedirectUri: '/profile',
		secret: import.meta.env.VITE_SECRET,
	});

	return serverSdk;
}
