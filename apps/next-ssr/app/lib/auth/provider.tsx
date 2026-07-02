'use client';

import type { ReactNode } from 'react';
import type { NextAuthProviderInitConfig, SessionData } from '@strivacity/sdk-next/types';
import { createDefaultLogging, StyAuthProvider } from '@strivacity/sdk-next/client';
import { sdkOptions } from './options';

export const options: NextAuthProviderInitConfig = {
	...(sdkOptions as NextAuthProviderInitConfig),
	logging: createDefaultLogging(),
};

export function AuthProvider({ session, children }: { session?: SessionData | null; children: ReactNode }) {
	return (
		<StyAuthProvider options={options} session={session}>
			{children}
		</StyAuthProvider>
	);
}
