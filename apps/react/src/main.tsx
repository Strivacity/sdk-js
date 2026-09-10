import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import type { SessionData } from '@strivacity/sdk-react';
import { options, AuthProvider } from './components/Provider';
import { App } from './components/App';
import '@strivacity/common/styles/globals.css';

import Callback from './pages/Callback';
import Entry from './pages/Entry';
import Error from './pages/Error';
import Home from './pages/Home';
import Login from './pages/Login';
import Logout from './pages/Logout';
import Profile from './pages/Profile';
import Register from './pages/Register';
import Revoke from './pages/Revoke';

// BFF mode only (serverSessionUri set): the client SDK never holds a session, so fetch the server-managed one before rendering
let session: SessionData | null | undefined;

if (options.serverSessionUri) {
	const response = await fetch('/auth/session', { credentials: 'include' });

	if (response.ok) {
		session = await response.json();
	}
}

createRoot(document.getElementById('app')!).render(
	<BrowserRouter>
		<AuthProvider session={session}>
			<Routes>
				<Route path="/" element={<App />}>
					<Route index element={<Home />} />
					<Route path="/callback" element={<Callback />} />
					<Route path="/error" element={<Error />} />
					<Route path="/entry" element={<Entry />} />
					<Route path="/login" element={<Login />} />
					<Route path="/logout" element={<Logout />} />
					<Route path="/profile" element={<Profile />} />
					<Route path="/register" element={<Register />} />
					<Route path="/revoke" element={<Revoke />} />
				</Route>
			</Routes>
		</AuthProvider>
	</BrowserRouter>,
);
