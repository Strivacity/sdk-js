import type { NativeFlow } from '@strivacity/sdk-preact';
import { useStrivacity } from '@strivacity/sdk-preact';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';

export default function Entry() {
	const { loading, sdk, entry } = useStrivacity<NativeFlow>();

	useEffect(() => {
		if (loading) {
			return;
		}

		if (!['embedded', 'native'].includes(sdk.options.mode)) {
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
				route(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
	}, [loading, sdk]);

	return null;
}
