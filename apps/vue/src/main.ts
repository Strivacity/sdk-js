import { createApp } from 'vue';
import { router } from './router';
import { createStrivacitySDK } from '@strivacity/sdk-vue';
import AppComponent from './components/app.component.vue';

const app = createApp(AppComponent);
const sdk = createStrivacitySDK({
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.vue',
});

app.use(router);
app.use(sdk);

app.mount('#app');
