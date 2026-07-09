'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RefreshDevices() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	function handleRefresh() {
		setLoading(true);
		router.refresh();
		setLoading(false);
	}

	return (
		<button onClick={() => void handleRefresh()} disabled={loading} data-button="refresh-devices">
			{loading ? 'Refreshing...' : 'Refresh Registered Devices'}
		</button>
	);
}
