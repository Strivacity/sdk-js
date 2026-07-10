import type { Routes } from '@angular/router';
import { CallbackPage } from './pages/callback';
import { EntryPage } from './pages/entry';
import { ErrorPage } from './pages/error';
import { HomePage } from './pages/home';
import { LoginPage } from './pages/login';
import { LogoutPage } from './pages/logout';
import { ProfilePage } from './pages/profile';
import { RegisterPage } from './pages/register';
import { RevokePage } from './pages/revoke';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
	{ path: '', component: HomePage },
	{ path: 'callback', component: CallbackPage },
	{ path: 'entry', component: EntryPage },
	{ path: 'error', component: ErrorPage },
	{ path: 'login', component: LoginPage },
	{ path: 'logout', component: LogoutPage },
	{ path: 'profile', component: ProfilePage, canActivate: [authGuard] },
	{ path: 'register', component: RegisterPage },
	{ path: 'revoke', component: RevokePage },
];
