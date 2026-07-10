import { sdkOptions } from '../lib/auth/options';
import CallbackServer from './server';
import CallbackClient from './client';

export default async function CallbackPage({ searchParams }) {
	const params = new URLSearchParams(await searchParams);

	// NOTE: This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSideSession` setting.
	if (sdkOptions.serverSideSession) {
		return <CallbackServer params={params} />;
	} else {
		return <CallbackClient />;
	}
}
