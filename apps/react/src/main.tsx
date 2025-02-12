import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { type SDKOptions, AuthProvider, useStrivacity } from '@strivacity/sdk-react';
import { App } from './components/App';
import { Callback } from './pages/Callback';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Logout } from './pages/Logout';
import { Profile } from './pages/Profile';
import { Register } from './pages/Register';
import { Revoke } from './pages/Revoke';

const options: SDKOptions = {
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: 'http://localhost:4200/callback',
	storageTokenName: 'sty.session.react',
};

const RouteGuard = ({ children }: { children: React.ReactElement }) => {
	const { loading, isAuthenticated } = useStrivacity();

	if (loading) {
		return <h1>Loading...</h1>;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return children;
};

createRoot(document.getElementById('app')!).render(
	<BrowserRouter>
		<AuthProvider options={options}>
			<Routes>
				<Route element={<App />}>
					<Route index element={<Home />} />
					<Route path="/callback" element={<Callback />} />
					<Route path="/login" element={<Login />} />
					<Route path="/logout" element={<Logout />} />
					<Route
						path="/profile"
						element={
							<RouteGuard>
								<Profile />
							</RouteGuard>
						}
					/>
					<Route path="/register" element={<Register />} />
					<Route path="/revoke" element={<Revoke />} />
				</Route>
			</Routes>
		</AuthProvider>
	</BrowserRouter>,
);
