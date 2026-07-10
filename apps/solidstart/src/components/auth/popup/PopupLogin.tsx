import type { PopupFlow } from '@strivacity/sdk-solid/client';
import { onSettled } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import { extraParams } from '../../../options';

export default function PopupLogin(props: { flowType: 'login' | 'register' }) {
	const ctx = useStrivacity<PopupFlow>();

	onSettled(() => {
		(props.flowType === 'register' ? ctx.register(extraParams) : ctx.login(extraParams))
			.then(() => {
				globalThis.location.href = '/profile';
			})
			.catch((error) => {
				globalThis.location.href = `/error?error_description=${encodeURIComponent(error.message)}`;
			});
	});

	return (
		<section>
			<p>Loading...</p>
		</section>
	);
}
