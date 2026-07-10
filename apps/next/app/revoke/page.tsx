import { sdkOptions } from '../lib/auth/options';
import RevokeServer from './server';
import RevokeClient from './client';

export default function RevokePage() {
	// NOTE: This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSideSession` setting.
	if (sdkOptions.serverSideSession) {
		return <RevokeServer />;
	} else {
		return <RevokeClient />;
	}
}
