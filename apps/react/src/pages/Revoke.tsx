import { useStrivacity } from '@strivacity/sdk-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function Revoke() {
	const { loading, revoke } = useStrivacity();
	const navigate = useNavigate();

	useEffect(() => {
		if (loading) {
			return;
		}

		revoke()
			.then(() => {
				globalThis.location.href = '/';
			})
			.catch((error) => {
				void navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
	}, [loading, revoke]);

	return null;
}
