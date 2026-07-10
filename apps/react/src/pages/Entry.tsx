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

		if (!['embedded', 'native'].includes(sdk.options.mode)) {
			// NOTE: Invalid usage: In non-embedded modes, the entry url should redirect to the hosted login page directly.
			globalThis.location.href = '/login';
			return;
		}

		entry()
			.then((params) => {
				const url = new URL(sdk.options.loginUri, globalThis.location.origin);
				url.search = new URLSearchParams(params).toString();
				globalThis.location.href = url.toString();
			})
			.catch((error) => {
				void navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
	}, [loading, sdk, entry]);

	return null;
}
