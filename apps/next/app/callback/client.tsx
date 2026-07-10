'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function CallbackClient() {
	const { loading, handleCallback } = useStrivacity();
	const router = useRouter();
	const searchParams = new URLSearchParams(globalThis.window?.location.search);

	useEffect(() => {
		if (loading) {
			return;
		}

		if (searchParams.get('error') || searchParams.get('error_description')) {
			router.replace(`/error?${searchParams.toString()}`);
			return;
		}

		handleCallback()
			.then(() => {
				router.push('/profile');
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
