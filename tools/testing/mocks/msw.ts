import { expect } from 'vitest';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import openidConfiguration from '../fixtures/openid-configuration.json';

export const handlers = [
	http.get(/\/\.well-known\/openid-configuration/, () => HttpResponse.json(openidConfiguration)),
	http.get(/\/oauth2\/token/, () => HttpResponse.json(openidConfiguration)),
];

export const server = setupServer(...handlers);
