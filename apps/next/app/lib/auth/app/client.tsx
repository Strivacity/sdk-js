'use client';

/* eslint-disable @next/next/no-html-link-for-pages */

import { useStrivacity } from '@strivacity/sdk-next/client';

export function AppClient({ children }: { children: React.ReactNode }) {
	const { sdk } = useStrivacity();
	const session = sdk?.session;
	const isAuthenticated = !!session?.access_token;
	const name = isAuthenticated ? `${session.claims?.given_name} ${session?.claims?.family_name}` : null;

	return (
		<div id="app">
			<header>
				<div>{isAuthenticated ? <strong>Welcome, {name}!</strong> : null}</div>
				<div>
					<a href="/" data-button="home">
						Home
					</a>
					{isAuthenticated ? (
						<>
							<a href="/profile" data-button="profile">
								Profile
							</a>
							<a href="/revoke" data-button="revoke">
								Revoke
							</a>
							<a href="/logout" data-button="logout">
								Logout
							</a>
						</>
					) : (
						<>
							<a href="/login" data-button="login">
								Login
							</a>
							<a href="/register" data-button="register">
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
