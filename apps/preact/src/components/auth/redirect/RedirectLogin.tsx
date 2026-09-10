import { useEffect } from 'preact/compat';
import type { PopupFlow } from '@strivacity/sdk-preact';
import { useStrivacity } from '@strivacity/sdk-preact';
import { extraParams } from '../';

export default function RedirectLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const { loading, login, register } = useStrivacity<PopupFlow>();

	useEffect(() => {
		if (loading) {
			return;
		}

		if (flowType === 'register') {
			void register(extraParams);
		} else {
			void login(extraParams);
		}
	}, [loading, flowType, login, register]);

	return (
		<section>
			<p>Loading...</p>
		</section>
	);
}
