import { useEffect, useRef } from 'preact/compat';
import type { PopupFlow } from '@strivacity/sdk-preact';
import { useStrivacity } from '@strivacity/sdk-preact';
import { extraParams } from '../';

export default function PopupLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const { loading, login, register } = useStrivacity<PopupFlow>();
	const startedRef = useRef(false);

	useEffect(() => {
		if (loading || startedRef.current) {
			return;
		}

		// Prevent multiple calls (React StrictMode)
		startedRef.current = true;

		(flowType === 'register' ? register(extraParams) : login(extraParams))
			.then(() => {
				globalThis.location.href = '/profile';
			})
			.catch((error) => {
				globalThis.location.href = `/error?error_description=${encodeURIComponent(error.message)}`;
			});
	}, [loading, flowType, login, register]);

	return (
		<section>
			<p>Loading...</p>
		</section>
	);
}
