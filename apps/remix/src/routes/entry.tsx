import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrivacity } from '@strivacity/sdk-remix';

export default function Entry() {
	const navigate = useNavigate();
	const { loading, entry } = useStrivacity();

	useEffect(() => {
		if (loading) return;

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
	}, [loading]);

	return (
		<section>
			<h1>Redirecting...</h1>
		</section>
	);
}
