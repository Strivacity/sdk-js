import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity } from '@strivacity/sdk-react';

export const Entry = () => {
	const navigate = useNavigate();
	const { entry } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			try {
				const sessionId = await entry();

				if (sessionId) {
					await navigate(`/callback?session_id=${sessionId}`);
				} else {
					await navigate('/');
				}
			} catch (error) {
				alert(error);
				await navigate('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
};
