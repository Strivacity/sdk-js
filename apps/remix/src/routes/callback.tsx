import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStrivacity } from '@strivacity/sdk-remix';

export default function Callback() {
	const query = globalThis?.window ? Object.fromEntries(new URLSearchParams(globalThis.window.location.search)) : {};
	const navigate = useNavigate();
	const { handleCallback } = useStrivacity();

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			await handleCallback();
			await navigate('/profile');
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
}
