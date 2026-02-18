'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Callback() {
	const query = globalThis?.window ? Object.fromEntries(new URLSearchParams(globalThis.window.location.search)) : {};
	const router = useRouter();
	const { sdk, loading } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			const url = new URL(location.href);

			if (url.searchParams.has('session_id')) {
				router.push(`/login?${url.searchParams}`);
			} else {
				if (loading) {
					return;
				}

				try {
					await sdk.handleCallback();
					router.push('/profile');
				} catch (error) {
					// eslint-disable-next-line no-console
					console.error('Error during callback handling:', error);
				}
			}
		})();
	}, [loading]);

	if (query.error) {
		return (
			<section>
				<h1>Error in authentication</h1>
				<div>
					<h4>{query.error}</h4>
					<p>{query.error_description}</p>
				</div>
			</section>
		);
	} else {
		return (
			<section>
				<h1>Logging in...</h1>
			</section>
		);
	}
}
