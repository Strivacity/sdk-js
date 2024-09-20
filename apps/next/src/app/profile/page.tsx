'use client';

import Link from 'next/link';
import { useStrivacity } from '@strivacity/sdk-next';

export default function Profile() {
	const { loading, isAuthenticated, accessToken, accessTokenExpired, accessTokenExpirationDate, idTokenClaims, refreshToken } = useStrivacity();

	if (loading) {
		return <h1>Loading...</h1>;
	}

	if (!isAuthenticated) {
		return <Link href="/login" replace />;
	}

	return (
		<section>
			<dl>
				<dt>
					<strong>accessToken</strong>
				</dt>
				<dd>
					<pre>{JSON.stringify(accessToken)}</pre>
				</dd>
				<dt>
					<strong>refreshToken</strong>
				</dt>
				<dd>
					<pre>{JSON.stringify(refreshToken)}</pre>
				</dd>
				<dt>
					<strong>accessTokenExpired</strong>
				</dt>
				<dd>
					<pre>{JSON.stringify(accessTokenExpired)}</pre>
				</dd>
				<dt>
					<strong>accessTokenExpirationDate</strong>
				</dt>
				<dd>
					<pre>{accessTokenExpirationDate ? new Date(accessTokenExpirationDate * 1000).toLocaleString() : JSON.stringify(null)}</pre>
				</dd>
				<dt>
					<strong>claims</strong>
				</dt>
				<dd>
					<pre>{JSON.stringify(idTokenClaims, null, 2)}</pre>
				</dd>
			</dl>
		</section>
	);
}
