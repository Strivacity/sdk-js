import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStrivacity } from '@strivacity/sdk-react';
import './App.css';

export const App = () => {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	const [name, setName] = useState('');

	useEffect(() => {
		setName(`${idTokenClaims?.given_name} ${idTokenClaims?.family_name}`);
	}, [isAuthenticated, idTokenClaims]);

	return (
		<>
			<header>
				<div>{isAuthenticated ? <strong>Welcome, {name}!</strong> : loading ? <strong>Loading...</strong> : null}</div>
				<div>
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
					) : null}
					{!isAuthenticated ? (
						<>
							<Link to="/login" data-button="login">
								Login
							</Link>
							<Link to="/register" data-button="register">
								Register
							</Link>
						</>
					) : null}
				</div>
			</header>
			<Outlet />
		</>
	);
};
