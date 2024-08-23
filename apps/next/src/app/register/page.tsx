'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Register() {
	const router = useRouter();
	const { register } = useStrivacity();

	useEffect(() => {
		(async () => {
			await register();
			router.push('/profile');
		})();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
}
