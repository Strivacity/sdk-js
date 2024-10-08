import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrivacity } from '@strivacity/sdk-react';

export const Login = () => {
	const navigate = useNavigate();
	const { login } = useStrivacity();

	useEffect(() => {
		(async () => {
			await login();
			navigate('/profile');
		})();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
};
