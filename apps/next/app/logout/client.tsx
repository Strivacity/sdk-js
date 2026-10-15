'use client';

import { useEffect } from 'react';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function LogoutClient() {
	const { loading, logout } = useStrivacity();

	useEffect(() => {
		if (loading) {
			return;
		}

		void logout({ postLogoutRedirectUri: new URL('/', globalThis.location.origin).toString() });
	}, [loading]);

	return null;
}
