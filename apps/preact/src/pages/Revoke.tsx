import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';

export default function Revoke() {
	const { loading, revoke } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		revoke()
			.then(() => {
				globalThis.location.href = '/';
			})
			.catch((error) => {
				route(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
	}, [loading]);

	return null;
}
