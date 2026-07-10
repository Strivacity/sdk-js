import { withAuthGuard, useStrivacity } from '@strivacity/sdk-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

export default withAuthGuard(function Profile() {
	const { sdk, refresh } = useStrivacity();
	const navigate = useNavigate();
	const session = sdk?.session;

	const idTokenRef = useRef<HTMLElement & { value?: string | null }>(null);
	const accessTokenRef = useRef<HTMLElement & { value?: string | null; expiresAt?: number | null }>(null);
	const refreshTokenRef = useRef<HTMLElement & { value?: string | null }>(null);

	useEffect(() => {
		void import('@strivacity/common/components/token-field');
	}, []);

	useEffect(() => {
		if (idTokenRef.current) {
			idTokenRef.current.value = session?.id_token ?? null;
		}

		if (accessTokenRef.current) {
			accessTokenRef.current.value = session?.access_token ?? null;
			accessTokenRef.current.expiresAt = session?.expires_at ?? null;
		}

		if (refreshTokenRef.current) {
			refreshTokenRef.current.value = session?.refresh_token ?? null;
		}
	}, [session]);

	useEffect(() => {
		const el = refreshTokenRef.current;

		if (!el) {
			return;
		}

		const handler = () => {
			refresh()
				.then(() => globalThis.location.reload())
				.catch((error) => void navigate(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`));
		};

		el.addEventListener('refreshToken', handler);

		return () => el.removeEventListener('refreshToken', handler);
	}, [navigate, refresh]);

	return (
		<section>
			<sty-app-token-field ref={idTokenRef} type="id_token"></sty-app-token-field>
			<sty-app-token-field ref={accessTokenRef} type="access_token"></sty-app-token-field>
			<sty-app-token-field ref={refreshTokenRef} type="refresh_token"></sty-app-token-field>
		</section>
	);
});
