import { Router, Request, Response } from 'express';
import { Session } from '@strivacity/sdk-core/utils/Session';
import { storage, startSession, finalizeSession, refreshSession, revokeSession, getLogoutUrl, entrySession, OAuthError } from './utils';

export const router = Router();

router.get('/session/info', async (req: Request, res: Response) => {
	let session: Session | null = null;
	let accessTokenExpired = true;

	if (req.cookies?.session) {
		try {
			const data = storage.get(req.cookies.session) ?? null;

			if (data) {
				session = Session.load(data);
			}
		} catch (error) {
			console.error('Failed to retrieve session data', error as Error);
		}

		accessTokenExpired = !session?.access_token || !session?.expires_at || session.expires_at <= Math.floor(Date.now() / 1000);

		// Attempt to refresh the token if it has expired
		if (accessTokenExpired && session?.refresh_token) {
			await refreshSession(req.cookies.session);
		}
	}

	res.json({ accessTokenExpired, claims: session?.claims ?? null });
});

router.post('/session/start', async (req: Request, res: Response) => {
	res.clearCookie('session');

	try {
		const data = await startSession(req.body);
		res.json(data);
	} catch (error) {
		if (error instanceof OAuthError) {
			return res.status(400).json({ error: error.error, error_description: error.error_description });
		}
		res.status(500).json({
			error: 'Failed to start session',
			error_description: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});

router.post('/session/finalize', async (req: Request, res: Response) => {
	const sessionId = req.headers.authorization?.split(' ')[1];

	try {
		const id = await finalizeSession(sessionId, req.body);
		res
			.cookie('session', id, {
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
			})
			.status(204)
			.json();
	} catch (error) {
		if (error instanceof OAuthError) {
			return res.status(400).json({ error: error.error, error_description: error.error_description });
		}
		res.status(500).json({
			error: 'Failed to finalize session',
			error_description: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});

router.post('/session/refresh', async (req: Request, res: Response) => {
	const sessionId = req.cookies?.session;

	try {
		await refreshSession(sessionId);
		console.log('Token successfully refreshed');
		res.status(204).json();
	} catch (error) {
		console.log(`Token refresh failed - ${error}`);

		if (error instanceof OAuthError) {
			return res.status(400).json({ error: error.error, error_description: error.error_description });
		}
		res.status(500).json({
			error: 'Failed to refresh session',
			error_description: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});

router.post('/session/revoke', async (req: Request, res: Response) => {
	const sessionId = req.cookies?.session;
	let success = true;

	try {
		await revokeSession(sessionId);
		res.clearCookie('session').status(204).json();
	} catch (error) {
		success = false;
		console.log(`Token revocation failed - ${error}`);

		if (error instanceof OAuthError) {
			return res.status(400).json({ error: error.error, error_description: error.error_description });
		}
		res.status(500).json({
			error: 'Failed to revoke session',
			error_description: error instanceof Error ? error.message : 'Unknown error',
		});
	} finally {
		storage.delete(sessionId);

		if (success) {
			console.log('Token successfully revoked');
		}
	}
});

router.post('/session/entry', async (req: Request, res: Response) => {
	try {
		const params = await entrySession(req.body);

		res.json(params).status(200);
	} catch (error) {
		res.status(500).json({
			error: 'Failed to enter session',
			error_description: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});

router.get('/session/logout', async (req: Request, res: Response) => {
	const sessionId = req.cookies?.session;
	const url = getLogoutUrl(sessionId);

	res.clearCookie('session').redirect(url.toString());
});
