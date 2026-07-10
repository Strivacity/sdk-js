import { useStrivacity } from '@strivacity/sdk-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function Callback() {
	const { loading, handleCallback } = useStrivacity();
	const navigate = useNavigate();
	const searchParams = new URLSearchParams(globalThis.window.location.search);

	useEffect(() => {
		(() => {
			if (loading) {
				return;
			}

			handleCallback()
				.then(() => {
					void navigate('/profile');
				})
				.catch(() => {
					void navigate(`/error?error=${encodeURIComponent('An error occurred during callback handling.')}`);
				});
		})();
	}, [loading]);

	if (searchParams.get('error') || searchParams.get('error_description')) {
		void navigate(`/error?${searchParams.toString()}`);
		return null;
	} else {
		return (
			<section>
				<h1>Logging in...</h1>
			</section>
		);
	}
}
