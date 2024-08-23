import { createRouter, createWebHistory } from 'vue-router';
import { isAuthenticated } from '@strivacity/sdk-vue';
import HomePage from './pages/index.page.vue';
import LoginPage from './pages/login.page.vue';
import RevokePage from './pages/revoke.page.vue';
import RegisterPage from './pages/register.page.vue';
import LogoutPage from './pages/logout.page.vue';
import CallbackPage from './pages/callback.page.vue';
import ProfilePage from './pages/profile.page.vue';

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: '/',
			name: 'home',
			component: HomePage,
		},
		{
			path: '/login',
			name: 'login',
			component: LoginPage,
		},
		{
			path: '/revoke',
			name: 'revoke',
			component: RevokePage,
		},
		{
			path: '/register',
			name: 'register',
			component: RegisterPage,
		},
		{
			path: '/logout',
			name: 'logout',
			component: LogoutPage,
		},
		{
			path: '/callback',
			name: 'callback',
			component: CallbackPage,
		},
		{
			path: '/profile',
			name: 'profile',
			component: ProfilePage,
			beforeEnter: async (_to, _from, next) => {
				if (!(await isAuthenticated())) {
					next('/login');
				} else {
					next();
				}
			},
		},
	],
});
