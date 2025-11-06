'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Entry() {
	const router = useRouter();
	const { entry } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			try {
				const sessionId = await entry();

				if (sessionId) {
					router.push(`/callback?session_id=${sessionId}`);
				} else {
					router.push('/');
				}
			} catch (error) {
				alert(error);
				router.push('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
}
