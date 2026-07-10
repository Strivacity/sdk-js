import type { AngularServerSDK, AngularServerSDKInitConfig, SDKOptions } from '@strivacity/sdk-angular/server';
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { createDefaultLogging } from '@strivacity/sdk-angular';
import { baseSdkOptions } from '../options';

export const sdkOptions: AngularServerSDKInitConfig = {
	...baseSdkOptions,
	secret: import.meta.env.VITE_SECRET,
	storageTokenName: 'sty.session.angular',
	postLoginRedirectUri: '/profile',
	logging: createDefaultLogging(),
};

let serverSdk: AngularServerSDK | undefined;

/**
 * Lazily creates the server SDK singleton. Kept lazy so that a build/route-introspection pass without real env vars doesn't crash.
 */
export function getServerSdk() {
	serverSdk ??= createServerSDK(sdkOptions);

	return serverSdk;
}
