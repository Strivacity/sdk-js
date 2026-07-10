import { useStrivacity } from '@strivacity/sdk-react';
import { useEffect } from 'react';

export default function Logout() {
	const { loading, logout } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		void logout();
	}, [loading, logout]);

	return null;
}
