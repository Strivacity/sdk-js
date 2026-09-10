import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function Revoke() {
	const ctx = useStrivacity();
	const navigate = useNavigate();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			// This demo shows both session modes side by side.
			// in your own app, keep only the branch matching your `serverSessionUri` setting.
			if (ctx.sdk.options.serverSessionUri) {
				globalThis.location.href = `/auth/revoke${globalThis.location.search}`;
				return;
			}

			(ctx.isAuthenticated() ? ctx.revoke() : Promise.resolve())
				.then(() => {
					navigate('/');
				})
				.catch((error) => {
					navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
				});
		},
	);

	return (
		<section>
			<h1>Logging out...</h1>
		</section>
	);
}
