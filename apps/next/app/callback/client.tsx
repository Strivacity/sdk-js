'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function CallbackClient() {
	const { loading, handleCallback } = useStrivacity();
	const router = useRouter();

	useEffect(() => {
		if (loading) {
			return;
		}

		handleCallback()
			.then(({ returnTo }) => {
				router.push(returnTo ?? '/profile');
			})
			.catch((error) => {
				router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
	}, [loading]);

	return (
		<section>
			<h1>Logging in...</h1>
		</section>
	);
}
