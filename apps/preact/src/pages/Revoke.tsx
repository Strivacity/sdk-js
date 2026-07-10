import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';

export default function Revoke() {
	const { sdk, loading, revoke } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		// This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSessionUri` setting.
		if (sdk.options.serverSessionUri) {
			globalThis.location.href = '/auth/revoke';
		} else {
			revoke()
				.then(() => {
					globalThis.location.href = '/';
				})
				.catch((error) => {
					route(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
				});
		}
	}, [loading]);

	return null;
}
