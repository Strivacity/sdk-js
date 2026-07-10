import { sdkOptions } from '../lib/auth/options';
import CallbackServer from './server';
import CallbackClient from './client';

export default async function CallbackPage({ searchParams }) {
	const params = new URLSearchParams(await searchParams);

	// This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSessionUri` setting.
	if (sdkOptions.serverSessionUri) {
		return <CallbackServer params={params} />;
	} else {
		return <CallbackClient />;
	}
}
