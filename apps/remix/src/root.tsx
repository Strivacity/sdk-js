import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { Link } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { type SDKOptions, StyAuthProvider, useStrivacity } from '@strivacity/sdk-remix';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import './App.css';

const options: SDKOptions = {
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.react',
};

export function AppHeader() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	const [name, setName] = useState('');

	useEffect(() => {
		setName(`${idTokenClaims?.given_name ?? ''} ${idTokenClaims?.family_name ?? ''}`);
	}, [isAuthenticated, idTokenClaims]);

	return (
		<header>
			<div>{isAuthenticated ? <strong>Welcome, {name}!</strong> : loading ? <strong>Loading...</strong> : null}</div>
			<div>
				{!loading && (
					<>
						<Link to="/" data-button="home">
							Home
						</Link>
						{isAuthenticated ? (
							<>
								<Link to="/profile" data-button="profile">
									Profile
								</Link>
								<Link to="/revoke" data-button="revoke">
									Revoke
								</Link>
								<Link to="/logout" data-button="logout">
									Logout
								</Link>
							</>
						) : (
							<>
								<Link to="/login" data-button="login">
									Login
								</Link>
								<Link to="/register" data-button="register">
									Register
								</Link>
							</>
						)}
					</>
				)}
			</div>
		</header>
	);
}

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				<div id="app">
					<ClientOnly>
						{() => (
							<BrowserRouter>
								<StyAuthProvider options={options}>
									<AppHeader></AppHeader>
									{children}
									<ScrollRestoration />
								</StyAuthProvider>
							</BrowserRouter>
						)}
					</ClientOnly>
				</div>
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
