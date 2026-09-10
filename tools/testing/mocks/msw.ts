import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import openidConfiguration from '../fixtures/openid-configuration.json';

export * from 'msw';

export const handlers = [http.get(/\/\.well-known\/openid-configuration/, () => HttpResponse.json(openidConfiguration))];

export const worker = setupServer(...handlers);
