import { sdkOptions } from '../lib/auth/options';
import LogoutServer from './server';
import LogoutClient from './client';

export default function LogoutPage() {
	// NOTE: This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSideSession` setting.
	if (sdkOptions.serverSideSession) {
		return <LogoutServer />;
	} else {
		return <LogoutClient />;
	}
}
