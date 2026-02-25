'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Entry() {
	const router = useRouter();
	const { loading, entry } = useStrivacity();

	useEffect(() => {
		if (loading) return;

		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			try {
				const data = await entry();

				if (data && Object.keys(data).length > 0) {
					router.push(`/callback?${new URLSearchParams(data).toString()}`);
				} else {
					router.push('/');
				}
			} catch (error) {
				alert(error);
				router.push('/');
			}
		})();
	}, [loading]);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
}
