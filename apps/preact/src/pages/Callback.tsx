import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';

export default function Callback() {
	const { loading, handleCallback } = useStrivacity();
	const searchParams = new URLSearchParams(globalThis.window.location.search);

	useEffect(() => {
		(() => {
			if (loading) {
				return;
			}

			handleCallback()
				.then(() => {
					globalThis.location.href = '/profile';
				})
				.catch(() => {
					globalThis.location.href = `/error?error=${encodeURIComponent('An error occurred during callback handling.')}`;
				});
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
