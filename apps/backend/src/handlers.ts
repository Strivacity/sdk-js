import type { Request as ExpressRequest } from 'express';
import { Router } from 'express';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { flushSetCookies } from '@strivacity/sdk-core/utils';
import { toWebRequest, applyResponse } from './utils';

// NOTE: `base.handler` and the matched `handleXxx` method both convert the request, so convert each one only once: the body
// stream of an Express request can only be read once.
const webRequests = new WeakMap<ExpressRequest, Request>();

const base = createBaseServerSDK<ExpressRequest>(
	{
		toRequest: (req) => {
			let request = webRequests.get(req);

			if (!request) {
				request = toWebRequest(req);
				webRequests.set(req, request);
			}

			return request;
		},
	},
	{
		mode: import.meta.env.VITE_MODE,
		issuer: import.meta.env.VITE_ISSUER,
		clientId: import.meta.env.VITE_CLIENT_ID,
		redirectUri: import.meta.env.VITE_REDIRECT_URI,
		scopes: import.meta.env.VITE_SCOPES?.split(' '),
		cookieSecret: import.meta.env.VITE_COOKIE_SECRET,
		storageTokenName: 'sty.session.backend',
	},
);

export const handlers = Router();

// NOTE: `base.handler` serves every auth route (`/login`, `/callback`, `/refresh`, `/logout`, ...) under `authUrlPrefix`, and
// returns null for anything else.
handlers.use(async (req, res, next) => {
	try {
		const response = await base.handler(req);

		if (response) {
			await applyResponse(response, res);
		} else {
			next();
		}
	} catch (error) {
		next(error);
	}
});

// NOTE: Demo only: returns the full server-managed session, including the ID and refresh tokens, so the profile page can
// display them. In your own app, return only what the UI needs (`toClientSession` drops the refresh and ID tokens) - never
// the refresh token.
handlers.get('/session', async (req, res) => {
	try {
		const session = await base.getSession(req);

		await applyResponse(flushSetCookies(req, Response.json(session ?? {})), res);
	} catch (error) {
		res.status(500).json({
			error: 'session_error',
			description: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});
