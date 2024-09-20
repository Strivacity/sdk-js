'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Revoke() {
	const router = useRouter();
	const { revoke } = useStrivacity();

	useEffect(() => {
		(async () => {
			try {
				await revoke();
			} catch {
			} finally {
				router.push('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Logging out...</h1>
		</section>
	);
}
