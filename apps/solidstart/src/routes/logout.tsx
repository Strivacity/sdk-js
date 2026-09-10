import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function Logout() {
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
				globalThis.location.href = `/auth/logout${globalThis.location.search}`;
				return;
			}

			if (ctx.isAuthenticated()) {
				void ctx.logout();
			} else {
				navigate('/');
			}
		},
	);

	return (
		<section>
			<h1>Logging out...</h1>
		</section>
	);
}
