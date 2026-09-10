import type { Request as ExpressRequest } from 'express';
import { Router } from 'express';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { toWebRequest, applyResponse } from './utils';

const base = createBaseServerSDK<ExpressRequest>(
	{
		toRequest: (req) => toWebRequest(req),
	},
	{
		mode: import.meta.env.VITE_MODE,
		issuer: import.meta.env.VITE_ISSUER,
		clientId: import.meta.env.VITE_CLIENT_ID,
		redirectUri: import.meta.env.VITE_REDIRECT_URI,
		scopes: import.meta.env.VITE_SCOPES?.split(' '),
		secret: import.meta.env.VITE_SECRET,
		storageTokenName: 'sty.session.backend',
	},
);

export const handlers = Router();

/**
 * Mounts one of the shared server SDK's `handleXxx` methods as an Express route, converting its `Response` back to Express.
 *
 * @param {'get' | 'post'} method - The HTTP method to mount the route on.
 * @param {string} path - The route path.
 * @param {(req: ExpressRequest) => Promise<Response>} handler - The shared server SDK handler to invoke.
 */
function mount(method: 'get' | 'post', path: string, handler: (req: ExpressRequest) => Promise<Response>): void {
	handlers[method](path, async (req, res, next) => {
		try {
			await applyResponse(await handler(req), res);
		} catch (error) {
			next(error);
		}
	});
}

mount('get', '/login', (req) => base.handleLogin(req));
mount('get', '/register', (req) => base.handleRegister(req));
mount('get', '/callback', (req) => base.handleCallback(req));
mount('get', '/refresh', (req) => base.handleRefresh(req));
mount('get', '/revoke', (req) => base.handleRevoke(req));
mount('get', '/entry', (req) => base.handleEntry(req));
mount('get', '/logout', (req) => base.handleLogout(req));
mount('post', '/backchannel-logout', (req) => base.handleBackChannelLogout(req));

handlers.get('/session', async (req, res) => {
	try {
		let session = await base.getSession(req);

		res.json(session ?? {});
	} catch (error) {
		res.status(500).json({
			error: 'session_error',
			description: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});
