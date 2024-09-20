'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Logout() {
	const router = useRouter();
	const { isAuthenticated, logout } = useStrivacity();

	useEffect(() => {
		(async () => {
			if (isAuthenticated) {
				await logout();
			} else {
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
