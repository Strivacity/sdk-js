import type { ComponentChildren } from 'preact';
import { useStrivacity } from '@strivacity/sdk-preact';

export function App({ children }: { children: ComponentChildren }) {
	const { isAuthenticated, idTokenClaims } = useStrivacity();
	const name = isAuthenticated ? `${idTokenClaims?.given_name} ${idTokenClaims?.family_name}` : null;

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
