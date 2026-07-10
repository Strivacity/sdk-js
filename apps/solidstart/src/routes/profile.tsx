import { createEffect, onSettled } from 'solid-js';
import { withAuthGuard, useStrivacity } from '@strivacity/sdk-solid/client';
import { useNavigate } from '@solidjs/router';

export default withAuthGuard(function Profile() {
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
		() => ({ access: ctx.accessToken(), refresh: ctx.refreshToken(), expiresAt: ctx.accessTokenExpirationDate() }),
		({ access, refresh, expiresAt }) => {
			if (idTokenEl) idTokenEl.value = ctx.sdk.session?.id_token ?? null;
			if (accessTokenEl) {
				accessTokenEl.value = access;
				accessTokenEl.expiresAt = expiresAt;
			}
			if (refreshTokenEl) refreshTokenEl.value = refresh;
		},
	);

	onSettled(() => {
		const el = refreshTokenEl;

		if (!el) {
			return;
		}

		const handler = () => {
			// This demo shows both session modes side by side.
			// in your own app, keep only the branch matching your `serverSessionUri` setting.
			if (ctx.sdk.options.serverSessionUri) {
				globalThis.location.href = '/auth/refresh?returnTo=/profile';
			} else {
				ctx
					.refresh()
					.then(() => globalThis.location.reload())
					.catch((error) => navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`));
			}
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
