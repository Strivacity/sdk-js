import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity } from '@strivacity/sdk-remix';

export default function Revoke() {
	const navigate = useNavigate();
	const { revoke } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			try {
				await revoke();
			} catch {
			} finally {
				await navigate('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Logging out...</h1>
		</section>
	);
}
