'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { type SDKOptions, StyAuthProvider, DefaultLogging, useStrivacity } from '@strivacity/sdk-next';
import './global.css';

const options: SDKOptions = {
	mode: process.env.MODE as 'redirect' | 'popup' | 'native',
	issuer: process.env.ISSUER as string,
	clientId: process.env.CLIENT_ID as string,
	scopes: process.env.SCOPES?.split(' ') as Array<string>,
	redirectUri: process.env.REDIRECT_URI as string,
	storageTokenName: 'sty.session.next',
	logging: DefaultLogging,
};

function App({ children }: { children: React.ReactNode }) {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	const [name, setName] = useState<string | null>(null);

	useEffect(() => {
		if (isAuthenticated) {
			setName(`${idTokenClaims?.given_name ?? ''} ${idTokenClaims?.family_name ?? ''}`);
		} else {
			setName(null);
		}
	}, [isAuthenticated, idTokenClaims]);

	return (
		<>
			<header>
				<div>{isAuthenticated ? <strong>Welcome, {name}!</strong> : loading ? <strong>Loading...</strong> : null}</div>
				<div>
					{!loading && (
						<>
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
							) : (
								<>
									<Link href="/login" data-button="login">
										Login
									</Link>
									<Link href="/register" data-button="register">
										Register
									</Link>
								</>
							)}
						</>
					)}
				</div>
			</header>
			{children}
		</>
	);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1.0" />
				<Script src={`${process.env.ISSUER}/assets/components/bundle.js`} type="module" strategy="lazyOnload" />
			</head>
			<body>
				<div id="app">
					<StyAuthProvider options={options}>
						<App>{children}</App>
					</StyAuthProvider>
				</div>
			</body>
		</html>
	);
}
