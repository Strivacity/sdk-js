import type { ReactNode } from 'react';
import type { SDKOptions, SessionData } from '@strivacity/sdk-react';
import { StyAuthProvider, createDefaultLogging } from '@strivacity/sdk-react';

export function AuthProvider({ session, children }: { session?: SessionData | null; children: ReactNode }) {
	return (
		<StyAuthProvider
			options={{
				mode: import.meta.env.VITE_MODE as SDKOptions['mode'],
				issuer: import.meta.env.VITE_ISSUER as SDKOptions['issuer'],
				clientId: import.meta.env.VITE_CLIENT_ID as SDKOptions['clientId'],
				scopes: import.meta.env.VITE_SCOPES?.split(' ') as SDKOptions['scopes'],
				redirectUri: import.meta.env.VITE_REDIRECT_URI as SDKOptions['redirectUri'],
				storageTokenName: 'sty.session.preact',
				logging: createDefaultLogging(),
			}}
			session={session}
		>
			{children}
		</StyAuthProvider>
	);
}
