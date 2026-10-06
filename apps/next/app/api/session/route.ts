import { sdk } from '../../lib/auth/server';

export const dynamic = 'force-dynamic';

// NOTE: Demo only: returns the full server-managed session, including the ID and refresh tokens, so the profile page can
// display them. The layout keeps these two tokens out of the page payload (`toClientSession`); in your own app, return only
// what the UI needs - never the refresh token.
export async function GET() {
	return Response.json(await sdk.getSession());
}
