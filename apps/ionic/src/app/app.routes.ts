import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'callback',
    loadComponent: () => import('./pages/callback/callback.page').then((m) => m.CallbackPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'logout',
    loadComponent: () => import('./pages/logout/logout.page').then((m) => m.LogoutPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'revoke',
    loadComponent: () => import('./pages/revoke/revoke.page').then((m) => m.RevokePage),
  },
];
