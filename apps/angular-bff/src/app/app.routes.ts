import { Routes } from '@angular/router';
import { CallbackPage } from './pages/callback';
import { HomePage } from './pages/home';
import { LoginPage } from './pages/login';
import { LogoutPage } from './pages/logout';
import { ProfilePage } from './pages/profile';
import { RegisterPage } from './pages/register';
import { RevokePage } from './pages/revoke';
import { EntryPage } from './pages/entry';

export const routes: Routes = [
	{ path: '', component: HomePage },
	{ path: 'callback', component: CallbackPage },
	{ path: 'login', component: LoginPage },
	{ path: 'logout', component: LogoutPage },
	{ path: 'profile', component: ProfilePage },
	{ path: 'register', component: RegisterPage },
	{ path: 'revoke', component: RevokePage },
	{ path: 'entry', component: EntryPage },
];
