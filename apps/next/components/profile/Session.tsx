'use client';

import { redirect } from 'next/navigation';
import { sdkOptions } from '../../app/lib/auth/options';
import { useStrivacity } from '@strivacity/sdk-next/client';
import { DateTime } from 'luxon';

export function Session() {
	const { loading, sdk, refresh } = useStrivacity();
	const session = sdk?.session;

	if (loading || !session) {
		return null;
	}

	function handleRefresh() {
		// NOTE: This demo shows both session modes side by side.
		// in your own app, keep only the branch matching your `serverSideSession` setting.
		if (sdkOptions.serverSideSession) {
			globalThis.location.href = '/auth/refresh?returnTo=/profile';
		} else {
			refresh()
				.then(() => {
					globalThis.location.reload();
				})
				.catch((error) => {
					redirect(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
				});
		}
	}

	return (
		<section>
			<h2>Session</h2>
			<dl>
				<dt>expires</dt>
				<dd>{session.expires_at ? DateTime.fromMillis(session.expires_at * 1000).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS) : '-'}</dd>

				<dt>access token</dt>
				<dd>{session.access_token}</dd>

				<dt>refresh token</dt>
				<dd>{session.refresh_token}</dd>

				{session.refresh_token && (
					<>
						<dt></dt>
						<dd>
							<button onClick={handleRefresh}>Refresh</button>
						</dd>
					</>
				)}

				<dt>account id</dt>
				<dd>{session.claims?.sub ?? '-'}</dd>

				<dt>claims</dt>
				<dd>
					<pre>{JSON.stringify(session.claims, null, 2)}</pre>
				</dd>
			</dl>
		</section>
	);
}
