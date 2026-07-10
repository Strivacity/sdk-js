import { sdkOptions } from '../lib/auth/options';
import RevokeServer from './server';
import RevokeClient from './client';

export default function RevokePage() {
	// This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSessionUri` setting.
	if (sdkOptions.serverSessionUri) {
		return <RevokeServer />;
	} else {
		return <RevokeClient />;
	}
}
