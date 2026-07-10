import { sdkOptions } from '../lib/auth/options';
import LogoutServer from './server';
import LogoutClient from './client';

export default function LogoutPage() {
	// This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSessionUri` setting.
	if (sdkOptions.serverSessionUri) {
		return <LogoutServer />;
	} else {
		return <LogoutClient />;
	}
}
