import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrivacity } from '@strivacity/sdk-remix';

export default function Entry() {
	const navigate = useNavigate();
	const { entry } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			try {
				const data = await entry();

				if (data && Object.keys(data).length > 0) {
					navigate(`/callback?${new URLSearchParams(data).toString()}`);
				} else {
					navigate('/');
				}
			} catch (error) {
				alert(error);
				navigate('/');
			}
		})();
	}, []);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
}
