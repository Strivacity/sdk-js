'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Callback() {
	const query = globalThis?.window ? Object.fromEntries(new URLSearchParams(globalThis.window.location.search)) : {};
	const router = useRouter();
	const { handleCallback } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			const url = new URL(location.href);
			const sessionId = url.searchParams.get('session_id');

			if (sessionId) {
				router.push(`/login?session_id=${sessionId}`);
			} else {
				try {
					await handleCallback();
					router.push('/profile');
				} catch (error) {
					// eslint-disable-next-line no-console
					console.error('Error during callback handling:', error);
				}
			}
		})();
	}, []);

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
