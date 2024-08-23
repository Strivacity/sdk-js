'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { type SDKOptions, AuthProvider, useStrivacity } from '@strivacity/sdk-next';
import './global.css';

const options: SDKOptions = {
	issuer: process.env.ISSUER as string,
	clientId: process.env.CLIENT_ID as string,
	scopes: process.env.SCOPES?.split(' ') as Array<string>,
	redirectUri: 'http://localhost:3000/callback',
	storageTokenName: 'sty.session.next',
};

function App({ children }: { children: React.ReactElement }) {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	const [name, setName] = useState<string | null>(null);

	useEffect(() => {
		if (isAuthenticated) {
			setName(`${idTokenClaims?.given_name} ${idTokenClaims?.family_name}`);
		} else {
			setName(null);
		}
	}, [isAuthenticated, idTokenClaims]);

	return (
		<>
			<header>
				<div>{isAuthenticated ? <strong>Welcome, {name}!</strong> : loading ? <strong>Loading...</strong> : null}</div>
				<div>
					<Link href="/" data-button="home">
						Home
					</Link>
					{isAuthenticated ? (
						<>
							<Link href="/profile" data-button="profile">
								Profile
							</Link>
							<Link href="/revoke" data-button="revoke">
								Revoke
							</Link>
							<Link href="/logout" data-button="logout">
								Logout
							</Link>
						</>
					) : null}
					{!isAuthenticated ? (
						<>
							<Link href="/login" data-button="login">
								Login
							</Link>
							<Link href="/register" data-button="register">
								Register
							</Link>
						</>
					) : null}
				</div>
			</header>
			{children}
		</>
	);
}

export default function RootLayout({ children }: { children: React.ReactElement }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1.0" />
			</head>
			<body>
				<div id="app">
					<AuthProvider options={options}>
						<App>{children}</App>
					</AuthProvider>
				</div>
			</body>
		</html>
	);
}
