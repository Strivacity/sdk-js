import { createEffect } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function Callback() {
	const ctx = useStrivacity();
	const [searchParams] = useSearchParams();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			// This demo shows both session modes side by side.
			// in your own app, keep only the branch matching your `serverSessionUri` setting.
			if (ctx.sdk.options.serverSessionUri) {
				globalThis.location.href = `/auth/callback${globalThis.location.search}`;
				return;
			}

			ctx
				.handleCallback()
				.then(() => {
					globalThis.location.href = '/profile';
				})
				.catch(() => {
					globalThis.location.href = `/error?error=${encodeURIComponent('An error occurred during callback handling.')}`;
				});
		},
	);

	return (
		<section>
			{searchParams.error || searchParams.error_description ? (
				<>
					<h1>Error in authentication</h1>
					<div>
						<h4>{searchParams.error}</h4>
						<p>{searchParams.error_description}</p>
					</div>
				</>
			) : (
				<h1>Logging in...</h1>
			)}
		</section>
	);
}
