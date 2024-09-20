import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrivacity } from '@strivacity/sdk-react';

export const Logout = () => {
	const navigate = useNavigate();
	const { isAuthenticated, logout } = useStrivacity();

	useEffect(() => {
		(async () => {
			if (isAuthenticated) {
				await logout();
			} else {
				navigate('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Logging out...</h1>
		</section>
	);
};
