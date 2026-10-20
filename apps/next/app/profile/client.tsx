'use client';

import { withAuthGuard, useStrivacity } from '@strivacity/sdk-next/client';
import type { SessionData } from '@strivacity/sdk-next/client';
import { useEffect, useRef, useState } from 'react';
import { redirect } from 'next/navigation';

export function ProfileView() {
	const { sdk, refresh } = useStrivacity();
	const serverManaged = !!sdk?.options.serverSessionUri;
	const [serverSession, setServerSession] = useState<SessionData | null>(null);
	// This demo shows both session modes side by side.
	// Server-managed: the provider's session has no ID and refresh tokens, so this demo reads the full session from its own
	// demo-only route (app/api/session/route.ts). Client-managed: the browser SDK holds the full session.
	const session = serverManaged ? serverSession : sdk?.session;

	const idTokenRef = useRef<HTMLElement & { value?: string | null }>(null);
	const accessTokenRef = useRef<HTMLElement & { value?: string | null; expiresAt?: number | null }>(null);
	const refreshTokenRef = useRef<HTMLElement & { value?: string | null }>(null);

	useEffect(() => {
		void import('@strivacity/common/components/token-field');
	}, []);

	useEffect(() => {
		if (!serverManaged) {
			return;
		}

		fetch('/api/session', { credentials: 'include' })
			.then(async (response) => (response.ok ? ((await response.json()) as SessionData | null) : null))
			.then((data) => setServerSession(data))
			.catch(() => setServerSession(null));
	}, [serverManaged]);

	useEffect(() => {
		if (idTokenRef.current) {
			idTokenRef.current.value = session?.id_token ?? null;
		}

		if (accessTokenRef.current) {
			accessTokenRef.current.value = session?.access_token ?? null;
			accessTokenRef.current.expiresAt = session?.expires_at ?? null;
		}

		if (refreshTokenRef.current) {
			refreshTokenRef.current.value = session?.refresh_token ?? null;
		}
	}, [session]);

	useEffect(() => {
		const el = refreshTokenRef.current;

		if (!el) {
			return;
		}

		const handler = () => {
			// Server-managed sessions: refresh() navigates to the server's refresh route (`${authUriPrefix}/refresh`), which comes back to /profile
			refresh({ returnTo: '/profile' })
				.then(() => {
					if (!sdk.options.serverSessionUri) {
						globalThis.location.reload();
					}
				})
				.catch((error) => redirect(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`));
		};

		el.addEventListener('refreshToken', handler);

		return () => el.removeEventListener('refreshToken', handler);
	}, [refresh]);

	return (
		<section>
			<sty-app-token-field ref={idTokenRef} type="id_token"></sty-app-token-field>
			<sty-app-token-field ref={accessTokenRef} type="access_token"></sty-app-token-field>
			<sty-app-token-field ref={refreshTokenRef} type="refresh_token"></sty-app-token-field>
		</section>
	);
}

// Client-managed sessions: only the browser can see the session, so guard on the client.
export const GuardedProfile = withAuthGuard(ProfileView);
