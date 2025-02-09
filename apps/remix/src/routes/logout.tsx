import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity } from '@strivacity/sdk-remix';

export default function Logout() {
	const navigate = useNavigate();
	const { isAuthenticated, logout } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			if (isAuthenticated) {
				await logout();
			} else {
				await navigate('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>logout</h1>
		</section>
	);
}
