import type { SessionData } from '@strivacity/sdk-solid/client';
import { createEffect, createMemo, onSettled } from 'solid-js';
import { withAuthGuard, useStrivacity } from '@strivacity/sdk-solid/client';
import { useNavigate } from '@solidjs/router';
import { getProfileSession } from '../server/session';

const ProfileTokens = withAuthGuard(function ProfileTokens(props: { serverSession: SessionData | null }) {
	const ctx = useStrivacity();
	const navigate = useNavigate();

	let idTokenEl: (HTMLElement & { value?: string | null }) | undefined;
	let accessTokenEl: (HTMLElement & { value?: string | null; expiresAt?: number | null }) | undefined;
	let refreshTokenEl: (HTMLElement & { value?: string | null }) | undefined;

	onSettled(() => {
		void import('@strivacity/common/components/token-field');
	});

	// ctx.accessToken() changing is the reactive signal that a session was obtained or refreshed
	createEffect(
		() => ({ access: ctx.accessToken(), refresh: ctx.refreshToken(), expiresAt: ctx.accessTokenExpirationDate(), server: props.serverSession }),
		({ access, refresh, expiresAt, server }) => {
			if (idTokenEl) {
				idTokenEl.value = server?.id_token ?? ctx.sdk.session?.id_token ?? null;
			}
			if (accessTokenEl) {
				accessTokenEl.value = access;
				accessTokenEl.expiresAt = expiresAt;
			}
			if (refreshTokenEl) {
				refreshTokenEl.value = server?.refresh_token ?? refresh;
			}
		},
	);

	onSettled(() => {
		const el = refreshTokenEl;

		if (!el) {
			return;
		}

		const handler = () => {
			// Server-managed sessions: refresh() navigates to the server's refresh route (`${authUriPrefix}/refresh`), which comes back to /profile
			ctx
				.refresh({ returnTo: '/profile' })
				.then(() => {
					if (!ctx.sdk.options.serverSessionUri) {
						globalThis.location.reload();
					}
				})
				.catch((error) => navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`));
		};

		el.addEventListener('refreshToken', handler);

		return () => el.removeEventListener('refreshToken', handler);
	});

	return (
		<section>
			<sty-app-token-field ref={(el: typeof idTokenEl) => (idTokenEl = el)} type="id_token"></sty-app-token-field>
			<sty-app-token-field ref={(el: typeof accessTokenEl) => (accessTokenEl = el)} type="access_token"></sty-app-token-field>
			<sty-app-token-field ref={(el: typeof refreshTokenEl) => (refreshTokenEl = el)} type="refresh_token"></sty-app-token-field>
		</section>
	);
});

export default function Profile() {
	// This demo shows both session modes side by side.
	// Server-managed: the provider's session has no ID/refresh token, so the full session comes from a demo-only server function. It is loaded
	// here, outside the guard, so a page load fetches it during SSR in the page's own request (sharing that request's session refresh)
	// instead of sending a second request after hydration.
	const serverSession = createMemo(() => getProfileSession());

	return <ProfileTokens serverSession={serverSession()} />;
}
