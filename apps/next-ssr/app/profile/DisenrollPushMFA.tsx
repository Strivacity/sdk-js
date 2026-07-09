'use client';

import { useState } from 'react';

export function DisenrollPushMFA() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleDisenroll() {
		if (!confirm('Are you sure you want to remove all registered devices?')) {
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const res = await fetch('/api/authenticators/disenroll', { method: 'DELETE' });

			if (!res.ok) {
				throw new Error(`Failed to disenroll: ${res.status}`);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div>
			<button onClick={() => void handleDisenroll()} disabled={loading} data-button="pushMFA-disenrol">
				{loading ? 'Removing...' : 'Remove All Devices'}
			</button>
			{error && <p style={{ color: 'red' }}>{error}</p>}
		</div>
	);
}
