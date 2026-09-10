import { createApp, h, Suspense } from 'vue';
import { createRouter, createWebHistory, type NavigationGuardWithThis } from 'vue-router';
import { createStrivacitySDK, createDefaultLogging, useStrivacity, type SDKOptions } from '@strivacity/sdk-vue';
import App from './App.vue';
import '@strivacity/common/styles/globals.css';

import Callback from './pages/Callback.vue';
import Entry from './pages/Entry.vue';
import Error from './pages/Error.vue';
import Home from './pages/Home.vue';
import Login from './pages/Login.vue';
import Logout from './pages/Logout.vue';
import Profile from './pages/Profile.vue';
import Register from './pages/Register.vue';
import Revoke from './pages/Revoke.vue';

const routeGuard: NavigationGuardWithThis<undefined> = async (_to, _from) => {
	const { sdk, isAuthenticated } = useStrivacity();

	await sdk.init();

	if (!isAuthenticated.value) {
		return '/login';
	}
};

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: '/',
			name: 'home',
			component: Home,
		},
		{
			path: '/callback',
			name: 'callback',
			component: Callback,
		},
		{
			path: '/error',
			name: 'error',
			component: Error,
		},
		{
			path: '/entry',
			name: 'entry',
			component: Entry,
		},
		{
			path: '/login',
			name: 'login',
			component: Login,
		},
		{
			path: '/logout',
			name: 'logout',
			component: Logout,
		},
		{
			path: '/profile',
			name: 'profile',
			component: Profile,
			beforeEnter: routeGuard,
		},
		{
			path: '/register',
			name: 'register',
			component: Register,
		},
		{
			path: '/revoke',
			name: 'revoke',
			component: Revoke,
		},
	],
});

const app = createApp({
	render: () => h(Suspense, null, { default: h(App) }),
});
app.use(router);
app.use(
	createStrivacitySDK({
		mode: import.meta.env.VITE_MODE as SDKOptions['mode'],
		issuer: import.meta.env.VITE_ISSUER as SDKOptions['issuer'],
		clientId: import.meta.env.VITE_CLIENT_ID as SDKOptions['clientId'],
		scopes: import.meta.env.VITE_SCOPES?.split(' ') as SDKOptions['scopes'],
		redirectUri: import.meta.env.VITE_REDIRECT_URI as SDKOptions['redirectUri'],
		storageTokenName: 'sty.session.vue',
		logging: createDefaultLogging(),
		// serverSessionUri: '/auth/login', // If you want to use server-side session storage, uncomment this line.
	}),
);
app.mount('#app');
