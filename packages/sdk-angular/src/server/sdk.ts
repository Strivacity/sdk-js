import type { AngularServerRequest, AngularServerSDK, AngularServerSDKInitConfig } from './types';
import { Router } from 'express';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { applyResponse, toWebRequest } from './utils';

function getRouteHandlers(base: ReturnType<typeof createBaseServerSDK<AngularServerRequest | undefined>>): Router {
	const router = Router();

	router.get('/login', async (req, res, next) => {
		try {
			const response = await base.handleLogin(req);
			await applyResponse(response, res);
		} catch (error) {
			next(error);
		}
	});
	router.get('/register', async (req, res, next) => {
		try {
			const response = await base.handleRegister(req);
			await applyResponse(response, res);
		} catch (error) {
			next(error);
		}
	});
	router.get('/callback', async (req, res, next) => {
		try {
			const response = await base.handleCallback(req);
			await applyResponse(response, res);
		} catch (error) {
			next(error);
		}
	});
	router.get('/refresh', async (req, res, next) => {
		try {
			const response = await base.handleRefresh(req);
			await applyResponse(response, res);
		} catch (error) {
			next(error);
		}
	});
	router.get('/revoke', async (req, res, next) => {
		try {
			const response = await base.handleRevoke(req);
			await applyResponse(response, res);
		} catch (error) {
			next(error);
		}
	});
	router.get('/entry', async (req, res, next) => {
		try {
			const response = await base.handleEntry(req);
			await applyResponse(response, res);
		} catch (error) {
			next(error);
		}
	});
	router.get('/logout', async (req, res, next) => {
		try {
			const response = await base.handleLogout(req);
			await applyResponse(response, res);
		} catch (error) {
			next(error);
		}
	});
	router.post('/backchannel-logout', async (req, res, next) => {
		try {
			const response = await base.handleBackChannelLogout(req);
			await applyResponse(response, res);
		} catch (error) {
			next(error);
		}
	});

	return router;
}

/**
 * Creates the server-side Strivacity SDK: an Express router exposing the auth endpoints and session helpers that can be reused elsewhere on the server.
 *
 * @param {AngularServerSDKInitConfig} initConfig - The SDK configuration options.
 * @returns {AngularServerSDK} The server-side SDK instance.
 */
export function createServerSDK(initConfig: AngularServerSDKInitConfig): AngularServerSDK {
	const base = createBaseServerSDK<AngularServerRequest | undefined>(
		{
			toRequest: (req) => toWebRequest(req as AngularServerRequest),
		},
		initConfig,
	);

	return {
		get options() {
			return base.options;
		},
		handlers: getRouteHandlers(base),
		getSession: (req) => base.getSession(req),
		updateSession: (session, req) => base.updateSession(session, req),
		refreshSession: (req) => base.refreshSession(req),
		revokeSession: (req) => base.revokeSession(req),
		getEntrySession: (entryUrl) => base.getEntrySession(entryUrl),
		completeLogin: (params, req) => base.completeLogin(params, req),
		logout: (postLogoutRedirectUri, req) => base.logout(postLogoutRedirectUri, req),
		handleLogin: (req) => base.handleLogin(req),
		handleRegister: (req) => base.handleRegister(req),
		handleCallback: (req) => base.handleCallback(req),
		handleRefresh: (req) => base.handleRefresh(req),
		handleRevoke: (req) => base.handleRevoke(req),
		handleEntry: (req) => base.handleEntry(req),
		handleLogout: (req) => base.handleLogout(req),
		handleBackChannelLogout: (req) => base.handleBackChannelLogout(req),
		handler: (req) => base.handler(req),
	};
}
