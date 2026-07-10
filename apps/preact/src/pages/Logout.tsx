import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';

export default function Logout() {
	const { sdk, loading, logout } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		// This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSessionUri` setting.
		if (sdk.options.serverSessionUri) {
			globalThis.location.href = '/auth/logout';
		} else {
			void logout();
		}
	}, [loading]);

	return null;
}
