import { redirect } from 'next/navigation';
import { sdk } from '../lib/auth/server';
import { fetchAccountData, introspectToken } from '../lib/auth/admin';
import { EnrollPushMFA } from './EnrollPushMFA';
import { DisenrollPushMFA } from './DisenrollPushMFA';
import { RefreshDevices } from './RefreshDevices';

export default sdk.withAuthGuard(
	async function ProfilePage() {
		const session = await sdk.getSession();

		if (!session) {
			redirect('/auth/login');
		}

		const { sub: accountId } = await introspectToken({ token: session.access_token });
		const accountData = await fetchAccountData({ accountId: accountId! });
		const authenticators = (accountData.authenticators?.methods ?? []).filter((authenticator) => authenticator.type === 'custom');

		return (
			<section className="profile">
				<dl className="profile-dl">
					<dt>account id</dt>
					<dd>{session.claims?.sub ?? '—'}</dd>

					<dt>access token</dt>
					<dd>{session.access_token}</dd>

					<dt>refresh token</dt>
					<dd>{session.refresh_token}</dd>

					<dt>expires</dt>
					<dd style={{ whiteSpace: 'normal' }}>{session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : '—'}</dd>
				</dl>

				<hr className="profile-hr" />

				<div className="profile-actions">
					<RefreshDevices />
					<EnrollPushMFA />
					<DisenrollPushMFA />
				</div>

				<div className="profile-section-title">Registered Devices</div>
				{authenticators.length === 0 ? (
					<p className="profile-muted">No devices registered.</p>
				) : (
					<table className="devices-table">
						<thead>
							<tr>
								<th>id</th>
								<th>type</th>
								<th>target</th>
								<th>enrolled</th>
								<th>last used</th>
							</tr>
						</thead>
						<tbody>
							{authenticators.map((m) => (
								<tr key={m.id}>
									<td>{m.id}</td>
									<td>{m.type}</td>
									<td>{m.target}</td>
									<td className="muted">{new Date(m.createdAt).toLocaleDateString()}</td>
									<td className="muted">{m.lastUsedAt ? new Date(m.lastUsedAt).toLocaleDateString() : '—'}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>
		);
	},
	{ returnTo: '/profile' },
);
