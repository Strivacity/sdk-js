import type { PopupFlow } from '@strivacity/sdk-solid/client';
import { onSettled } from 'solid-js';
import { useStrivacity } from '@strivacity/sdk-solid/client';
import { extraParams } from '../../../options';

export default function RedirectLogin(props: { flowType: 'login' | 'register' }) {
	const ctx = useStrivacity<PopupFlow>();

	onSettled(() => {
		if (props.flowType === 'register') {
			void ctx.register(extraParams);
		} else {
			void ctx.login(extraParams);
		}
	});

	return (
		<section>
			<p>Loading...</p>
		</section>
	);
}
