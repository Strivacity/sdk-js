'use client';

import type { ReactNode } from 'react';
import type { SessionData } from '@strivacity/sdk-next/client';
import { StyAuthProvider, createDefaultLogging } from '@strivacity/sdk-next/client';
import { sdkOptions } from './options';

export function AuthProvider({ session, children }: { session?: SessionData | null; children: ReactNode }) {
	return (
		<StyAuthProvider options={{ ...sdkOptions, logging: createDefaultLogging() }} session={session}>
			{children}
		</StyAuthProvider>
	);
}
