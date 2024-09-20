'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Login() {
	const router = useRouter();
	const { login } = useStrivacity();

	useEffect(() => {
		(async () => {
			await login();
			router.push('/profile');
		})();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
}
