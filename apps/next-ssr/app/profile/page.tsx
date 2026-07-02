import { sdk } from '../lib/auth/server';

export default sdk.withAuthGuard(
	async function ProfilePage() {
		const session = await sdk.getSession();
		const accountData = await sdk.myAccount.fetchAccountData();

		return (
			<section>
				<dl>
					<dt>
						<strong>accessToken</strong>
					</dt>
					<dd>
						<pre>{JSON.stringify(session.access_token).slice(1, -1)}</pre>
					</dd>
					<dt>
						<strong>refreshToken</strong>
					</dt>
					<dd>
						<pre>{JSON.stringify(session.refresh_token).slice(1, -1)}</pre>
					</dd>
					<dt>
						<strong>accessTokenExpirationDate</strong>
					</dt>
					<dd>
						<pre>{session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : JSON.stringify(null)}</pre>
					</dd>
					<dt>
						<strong>claims</strong>
					</dt>
					<dd>
						<pre>{JSON.stringify(session.claims, null, 2)}</pre>
					</dd>
					<dt>
						<strong>attributes</strong>
					</dt>
					<dd>
						<pre>{JSON.stringify(accountData.attributes, null, 2)}</pre>
						<pre>{JSON.stringify(accountData.data, null, 2)}</pre>
					</dd>
				</dl>
			</section>
		);
	},
	{ returnTo: '/profile' },
);
