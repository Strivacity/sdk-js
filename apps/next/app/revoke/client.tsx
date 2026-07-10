'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function RevokeClient() {
	const { loading, revoke } = useStrivacity();
	const router = useRouter();

	useEffect(() => {
		if (loading) {
			return;
		}

		revoke()
			.then(() => {
				router.push('/');
			})
			.catch((error) => {
				router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
	}, [loading]);

	return null;
}
