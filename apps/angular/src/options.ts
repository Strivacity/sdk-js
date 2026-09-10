import type { SDKInitConfig, SDKOptions } from '@strivacity/sdk-angular';
import { createDefaultLogging } from '@strivacity/sdk-angular';

export const baseSdkOptions: SDKInitConfig = {
	mode: import.meta.env.VITE_MODE as SDKOptions['mode'],
	issuer: import.meta.env.VITE_ISSUER as SDKOptions['issuer'],
	clientId: import.meta.env.VITE_CLIENT_ID as SDKOptions['clientId'],
	scopes: import.meta.env.VITE_SCOPES?.split(' ') as SDKOptions['scopes'],
	redirectUri: import.meta.env.VITE_REDIRECT_URI as SDKOptions['redirectUri'],
	storageTokenName: 'sty.session.next',
	logging: createDefaultLogging(),
	serverSessionUri: '/auth/login', // If you want to use client-side session storage, you can set this to false.
};
