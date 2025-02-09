import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity } from '@strivacity/sdk-remix';

export default function Register() {
	const navigate = useNavigate();
	const { register } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			await register();
			await navigate('/profile');
		})();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
}
