import { useStrivacity } from '@strivacity/sdk-preact';
import { DateTime } from 'luxon';
import { route } from 'preact-router';

export function Session() {
	const { loading, sdk, refresh } = useStrivacity();
	const session = sdk?.session;

	if (loading || !session) {
		return null;
	}

	function handleRefresh() {
		refresh()
			.then(() => {
				globalThis.location.reload();
			})
			.catch((error) => {
				route(`/error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
			});
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
