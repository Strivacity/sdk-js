'use client';

import type { NativeFlow } from '@strivacity/sdk-next/client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next/client';

export default function EntryPage() {
	const { loading, sdk, entry } = useStrivacity<NativeFlow>();
	const router = useRouter();

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
				router.push(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
	}, [loading, sdk, entry]);

	return null;
}
