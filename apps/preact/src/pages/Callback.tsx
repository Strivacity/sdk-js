import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';

export default function Callback() {
	const { sdk, loading, handleCallback } = useStrivacity();
	const searchParams = new URLSearchParams(globalThis.window.location.search);

	useEffect(() => {
		(() => {
			if (loading) {
				return;
			}

			// This demo shows both session modes side by side.
			// in your own app, keep only the branch matching your `serverSessionUri` setting.
			if (sdk.options.serverSessionUri) {
				globalThis.location.href = `/auth/callback?${searchParams.toString()}`;
			} else {
				handleCallback()
					.then(({ returnTo }) => {
						globalThis.location.href = returnTo ?? '/profile';
					})
					.catch((error) => {
						globalThis.location.href = `/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`;
					});
			}
		})();
	}, [loading]);

	return (
		<section>
			<h1>Logging in...</h1>
		</section>
	);
}
