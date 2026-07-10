import type { ReactNode } from 'react';
import type { SDKInitConfig, SDKOptions, SessionData } from '@strivacity/sdk-react';
import { StyAuthProvider, createDefaultLogging } from '@strivacity/sdk-react';

export const options: SDKInitConfig = {
	mode: import.meta.env.VITE_MODE as SDKOptions['mode'],
	issuer: import.meta.env.VITE_ISSUER as SDKOptions['issuer'],
	clientId: import.meta.env.VITE_CLIENT_ID as SDKOptions['clientId'],
	scopes: import.meta.env.VITE_SCOPES?.split(' ') as SDKOptions['scopes'],
	redirectUri: import.meta.env.VITE_REDIRECT_URI as SDKOptions['redirectUri'],
	storageTokenName: 'sty.session.preact',
	logging: createDefaultLogging(),
	// serverSessionUri: '/auth/login', // If you want to use server-side session storage, uncomment this line.
};

export function AuthProvider({ session, children }: { session?: SessionData | null; children: ReactNode }) {
	return (
		<StyAuthProvider options={options} session={session}>
			{children}
		</StyAuthProvider>
	);
}
