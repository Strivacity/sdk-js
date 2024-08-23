import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrivacity } from '@strivacity/sdk-react';

export const Register = () => {
	const navigate = useNavigate();
	const { register } = useStrivacity();

	useEffect(() => {
		(async () => {
			await register();
			navigate('/profile');
		})();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
};
