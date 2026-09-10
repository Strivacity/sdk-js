import type { NextServerSDKInitConfig } from '@strivacity/sdk-next/server/types';
import { createServerSDK, createDefaultLogging } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';

export const sdk = createServerSDK({
	...(sdkOptions as NextServerSDKInitConfig),
	logging: createDefaultLogging(),
	postLoginRedirectUri: '/profile',
	secret: process.env.SECRET as string,
});
