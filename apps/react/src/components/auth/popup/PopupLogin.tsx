import { useEffect, useRef } from 'react';
import type { PopupFlow } from '@strivacity/sdk-react';
import { useStrivacity } from '@strivacity/sdk-react';
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
