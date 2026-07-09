import type { NextServerSDKInitConfig } from '@strivacity/sdk-next/types';
import { createServerSDK, createDefaultLogging } from '@strivacity/sdk-next/server';
import { sdkOptions } from './options';

export const sdk = createServerSDK({
	...(sdkOptions as NextServerSDKInitConfig),
	storageTokenName: 'sty.session.next',
	logging: createDefaultLogging(),
	secret: process.env.SECRET as string,
	protectedRoutes: ['/profile'],
});
