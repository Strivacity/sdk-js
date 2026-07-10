import { render } from 'preact';
import Router, { Route } from 'preact-router';
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

render(
	<AuthProvider>
		<App>
			<Router>
				<Route path="/" component={Home} />
				<Route path="/callback" component={Callback} />
				<Route path="/error" component={Error} />
				<Route path="/entry" component={Entry} />
				<Route path="/login" component={Login} />
				<Route path="/logout" component={Logout} />
				<Route path="/profile" component={Profile} />
				<Route path="/register" component={Register} />
				<Route path="/revoke" component={Revoke} />
			</Router>
		</App>
	</AuthProvider>,
	document.getElementById('app')!,
);
