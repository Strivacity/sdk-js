'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function LogoutClient() {
	const { loading, logout } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		void logout();
	}, [loading]);

	return null;
}
