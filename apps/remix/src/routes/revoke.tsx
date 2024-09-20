import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrivacity } from '@strivacity/sdk-remix';

export default function Revoke() {
	const navigate = useNavigate();
	const { revoke } = useStrivacity();

	useEffect(() => {
		(async () => {
			try {
				await revoke();
			} catch {
			} finally {
				navigate('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Logging out...</h1>
		</section>
	);
}
