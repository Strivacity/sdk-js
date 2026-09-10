import type { NativeFlow } from '@strivacity/sdk-react';
import { useStrivacity } from '@strivacity/sdk-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function Entry() {
	const { loading, sdk, entry } = useStrivacity<NativeFlow>();
	const navigate = useNavigate();

	useEffect(() => {
		if (loading) {
			return;
		}

		entry()
			.then((params) => {
				const url = new URL('/login', globalThis.location.origin);
				url.search = new URLSearchParams(params).toString();
				globalThis.location.href = url.toString();
			})
			.catch((error) => {
				void navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
	}, [loading, sdk, entry]);

	return null;
}
