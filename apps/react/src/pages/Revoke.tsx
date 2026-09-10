import { useStrivacity } from '@strivacity/sdk-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function Revoke() {
	const { sdk, loading, revoke } = useStrivacity();
	const navigate = useNavigate();

	useEffect(() => {
		if (loading) {
			return;
		}

		// This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSessionUri` setting.
		if (sdk.options.serverSessionUri) {
			globalThis.location.href = '/auth/revoke';
		} else {
			revoke()
				.then(() => {
					globalThis.location.href = '/';
				})
				.catch((error) => {
					void navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
				});
		}
	}, [loading, revoke]);

	return null;
}
