import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './components/Provider';
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

createRoot(document.getElementById('app')!).render(
	<BrowserRouter>
		<AuthProvider>
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
