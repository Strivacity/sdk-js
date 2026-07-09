/* eslint-disable @next/next/no-html-link-for-pages */
import Link from 'next/link';
import { RefreshLink } from './lib/RefreshLink';
import { sdk } from './lib/auth/server';
import './globals.css';

export const dynamic = 'force-dynamic';

async function App({ children }: { children: React.ReactNode }) {
	const session = await sdk.getSession();
	const name = session ? `${session.claims?.given_name} ${session.claims?.family_name}` : null;

	return (
		<div id="app">
			<header>
				<div>{session ? <strong>Welcome, {name}!</strong> : null}</div>
				<div>
					<Link href="/" data-button="home">
						Home
					</Link>
					{session ? (
						<>
							<Link href="/profile" data-button="profile">
								Profile
							</Link>
							<RefreshLink data-button="refresh">Refresh</RefreshLink>
							<a href="/auth/revoke" data-button="revoke">
								Revoke
							</a>
							<a href="/auth/logout" data-button="logout">
								Logout
							</a>
						</>
					) : (
						<>
							<a href="/auth/login" data-button="login">
								Login
							</a>
							<a href="/auth/register" data-button="register">
								Register
							</a>
						</>
					)}
				</div>
			</header>
			{children}
		</div>
	);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en-US">
			<body>
				<App>{children}</App>
			</body>
		</html>
	);
}
