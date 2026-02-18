import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity } from '@strivacity/sdk-react';

export const Callback = () => {
	const query = globalThis?.window ? Object.fromEntries(new URLSearchParams(globalThis.window.location.search)) : {};
	const navigate = useNavigate();
	const { handleCallback } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			const url = new URL(location.href);

			if (url.searchParams.has('session_id')) {
				await navigate(`/login?${url.searchParams}`);
			} else {
				try {
					await handleCallback();
					await navigate('/profile');
				} catch (error) {
					// eslint-disable-next-line no-console
					console.error('Error during callback handling:', error);
				}
			}
		})();
	}, []);

	if (query.error) {
		return (
			<section>
				<h1>Error in authentication</h1>
				<div>
					<h4>{query.error}</h4>
					<p>{query.error_description}</p>
				</div>
			</section>
		);
	} else {
		return (
			<section>
				<h1>Logging in...</h1>
			</section>
		);
	}
};
