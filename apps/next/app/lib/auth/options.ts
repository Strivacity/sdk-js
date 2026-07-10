import type { SDKInitConfig, SDKOptions } from '@strivacity/sdk-next/client';

export const sdkOptions: SDKInitConfig = {
	mode: process.env.MODE as SDKOptions['mode'],
	issuer: process.env.ISSUER as SDKOptions['issuer'],
	clientId: process.env.CLIENT_ID as SDKOptions['clientId'],
	scopes: process.env.SCOPES?.split(' ') as SDKOptions['scopes'],
	redirectUri: process.env.REDIRECT_URI as SDKOptions['redirectUri'],
	storageTokenName: 'sty.session.next',
	serverSessionUri: '/auth/login', // If you want to use client-side session storage, you can set this to false.
};
