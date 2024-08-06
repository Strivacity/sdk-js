import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import openidConfiguration from './fixtures/openid-configuration.json';

export const mockServer = setupServer();

export const mocks = {
	wellKnown: () => {
		mockServer.use(
			http.get('https://brandtegrity.io/.well-known/openid-configuration', () => {
				return HttpResponse.json(openidConfiguration);
			}),
		);
	},
	tokenEndpoint: () => {
		mockServer.use(
			http.get('https://brandtegrity.io/oauth2/token', () => {
				return HttpResponse.json(openidConfiguration);
			}),
		);
	},
};
