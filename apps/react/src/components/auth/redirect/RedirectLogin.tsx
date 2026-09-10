import { useEffect } from 'react';
import type { RedirectFlow } from '@strivacity/sdk-react';
import { useStrivacity } from '@strivacity/sdk-react';
import { extraParams } from '../';

export default function RedirectLogin({ flowType }: { flowType: 'login' | 'register' }) {
	const { loading, login, register } = useStrivacity<RedirectFlow>();

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
