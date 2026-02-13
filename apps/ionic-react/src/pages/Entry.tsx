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
				const data = await entry();

				if (data && Object.keys(data).length > 0) {
					await navigate(`/callback?${new URLSearchParams(data).toString()}`);
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
