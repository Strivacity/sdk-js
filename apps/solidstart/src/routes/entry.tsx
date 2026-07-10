import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { NativeFlow } from '@strivacity/sdk-solid/client';
import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function Entry() {
	const ctx = useStrivacity<NativeFlow>();
	const navigate = useNavigate();

	createEffect(
		() => ctx.loading(),
		(loading) => {
			if (loading) {
				return;
			}

			ctx
				.entry()
				.then((params) => {
					const url = new URL('/login', globalThis.location.origin);
					url.search = new URLSearchParams(params).toString();
					globalThis.location.href = url.toString();
				})
				.catch((error) => {
					navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
				});
		},
	);

	return null;
}
