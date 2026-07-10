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
					.then(() => {
						globalThis.location.href = '/profile';
					})
					.catch(() => {
						globalThis.location.href = `/error?error=${encodeURIComponent('An error occurred during callback handling.')}`;
					});
			}
		})();
	}, [loading]);

	if (searchParams.get('error') || searchParams.get('error_description')) {
		globalThis.location.href = `/error?${searchParams.toString()}`;
		return null;
	} else {
		return (
			<section>
				<h1>Logging in...</h1>
			</section>
		);
	}
}
