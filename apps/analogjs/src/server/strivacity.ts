import type { AngularServerSDK, AngularServerSDKInitConfig, SDKOptions } from '@strivacity/sdk-angular/server';
import { createServerSDK } from '@strivacity/sdk-angular/server';
import { createDefaultLogging } from '@strivacity/sdk-angular';

export const sdkOptions: AngularServerSDKInitConfig = {
	mode: import.meta.env.VITE_MODE as SDKOptions['mode'],
	issuer: import.meta.env.VITE_ISSUER as SDKOptions['issuer'],
	clientId: import.meta.env.VITE_CLIENT_ID as SDKOptions['clientId'],
	scopes: import.meta.env.VITE_SCOPES?.split(' ') as SDKOptions['scopes'],
	redirectUri: import.meta.env.VITE_REDIRECT_URI as SDKOptions['redirectUri'],
	secret: import.meta.env.VITE_SECRET,
	storageTokenName: 'sty.session.analogjs.server',
	authUrlPrefix: '/auth',
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
