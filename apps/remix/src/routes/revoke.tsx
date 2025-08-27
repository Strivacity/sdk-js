import { useNavigate } from '@remix-run/react';
import { useStrivacity } from '@strivacity/sdk-remix';
import { useEffect } from 'react';

export default function Revoke() {
	const navigate = useNavigate();
	const { isAuthenticated, revoke } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			if (isAuthenticated) {
				await revoke();
			}

			navigate('/');
		})();
	}, []);

	return (
		<section>
			<h1>Logging out...</h1>
		</section>
	);
}
