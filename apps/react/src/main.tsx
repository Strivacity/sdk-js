import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { DefaultLogging, type SDKOptions, StyAuthProvider, useStrivacity } from '@strivacity/sdk-react';
import { App } from './components/App';
import { Callback } from './pages/Callback';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Logout } from './pages/Logout';
import { Profile } from './pages/Profile';
import { Register } from './pages/Register';
import { Revoke } from './pages/Revoke';
import { Entry } from './pages/Entry';

const options: SDKOptions = {
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.react',
	logging: DefaultLogging,
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
		<StyAuthProvider options={options}>
			<Routes>
				<Route path="/" element={<App />}>
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
					<Route path="/entry" element={<Entry />} />
				</Route>
			</Routes>
		</StyAuthProvider>
	</BrowserRouter>,
);
